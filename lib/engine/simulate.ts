import { emiFor } from './amortise';
import type {
  Breach,
  EngineInput,
  GoalConfig,
  GoalMonthState,
  GoalOutcome,
  MonthState,
  PurchasePlan,
  RecurringLine,
  SimulationResult,
} from './types';

export const DEFAULT_HORIZON = 36;
/** Total EMI load above this share of inflow raises an amber flag. */
export const EMI_LOAD_LIMIT = 0.4;

/** True when the line is in force and actually billed in this month. */
export function isDue(line: RecurringLine, month: number): boolean {
  const from = line.fromMonth ?? 1;
  const to = line.toMonth ?? Infinity;
  if (month < from || month > to) return false;
  const every = Math.max(1, Math.round(line.everyMonths ?? 1));
  // Billed in `from`, then every N months after it.
  return (month - from) % every === 0;
}

function sumActive(lines: RecurringLine[] | undefined, month: number): number {
  if (!lines) return 0;
  return lines.reduce(
    (total, line) => (isDue(line, month) ? total + line.amount : total),
    0,
  );
}

/*
 * `monthlyEquivalent` used to live here: a line's amount divided by its billing
 * period, for planning rather than simulation. Nothing calls it now. The
 * planning figures charge a bill in the month it is billed, the same as the
 * simulation, because dividing described a way of paying — a twelfth set aside
 * each month — that nobody was actually doing.
 */

function salaryAt(input: EngineInput, month: number): number {
  const steps = input.income.salarySteps ?? [];
  let amount = input.income.netSalary;
  for (const step of steps) {
    if (step.fromMonth <= month) amount = step.amount;
  }
  return amount;
}

/**
 * The bonus in a given month. Exported because `planningTotals` has to ask the
 * same question for month 1: a lump bonus is income in the month it lands and
 * nothing in the other eleven, and the header used to divide it by twelve
 * regardless of what the profile said.
 */
export function bonusAt(input: EngineInput, month: number): number {
  const bonus = input.income.bonus;
  if (!bonus || bonus.amount <= 0) return 0;
  if (input.income.bonusMode === 'amortised') return bonus.amount / 12;
  // Lump: lands in its month and repeats annually.
  if (month < bonus.month) return 0;
  return (month - bonus.month) % 12 === 0 ? bonus.amount : 0;
}

function loanEmisAt(input: EngineInput, month: number): number {
  if (!input.loans) return 0;
  return input.loans.reduce((total, loan) => {
    const start = loan.startMonth ?? 1;
    const end = start + loan.remainingMonths - 1;
    return month >= start && month <= end ? total + loan.emi : total;
  }, 0);
}

/** EMI a purchase charges, derived from price/rate/tenure when not supplied. */
export function purchaseEmiAmount(item: PurchasePlan): number {
  if (item.emiAmount != null) return item.emiAmount;
  const tenure = item.emiTenure ?? 0;
  if (tenure <= 0) return 0;
  const financed = item.price - (item.downPayment ?? 0);
  return emiFor(financed, item.annualRatePct ?? 0, tenure);
}

interface PurchaseRuntime {
  plan: PurchasePlan;
  /** save-then-buy pot. */
  pot: number;
  purchased: boolean;
  purchaseMonth: number | null;
  cashPaid: number;
}

/**
 * Month-by-month cashflow simulation.
 *
 * The flat `(target - current) / surplus` divide is wrong the moment an EMI
 * ends mid-horizon, so every number here comes out of an explicit loop.
 */
export function simulate(input: EngineInput): SimulationResult {
  const horizon = input.horizonMonths ?? DEFAULT_HORIZON;
  const monthlyReturn = (input.annualReturnPct ?? 0) / 12 / 100;
  const monthlyInflation = (input.annualInflationPct ?? 0) / 12 / 100;
  const allocationMode = input.allocationMode ?? 'waterfall';

  const goalConfigs: GoalConfig[] = [...(input.goals ?? [])].sort(
    (a, b) => a.priority - b.priority,
  );

  const balances = new Map<string, number>(
    goalConfigs.map((g) => [g.id, g.current]),
  );

  /**
   * What each goal takes every month.
   *
   * An amount the user typed wins: they are telling us what they will actually
   * put in, and a deadline they cannot meet at that rate is a warning to show
   * them, not a figure to quietly overwrite it with. Only then does the
   * deadline set the pace.
   *
   * Fixed at setup rather than re-based every month: a run-rate that moves for
   * reasons the user never sees makes the buffer impossible to reason about.
   */
  const runRates = new Map<string, number>(
    goalConfigs.map((g) => {
      if (g.fixedContribution != null) return [g.id, g.fixedContribution];

      if (g.deadlineMonth != null && g.deadlineMonth > 0) {
        return [g.id, Math.max(0, g.target - g.current) / g.deadlineMonth];
      }
      return [g.id, 0];
    }),
  );
  /** Fractional month each goal first reaches its target. */
  const completion = new Map<string, number>();

  const runtimes: PurchaseRuntime[] = (input.purchases ?? []).map((plan) => ({
    plan,
    pot: 0,
    purchased: false,
    purchaseMonth: null,
    cashPaid: 0,
  }));

  const months: MonthState[] = [];
  const breaches: Breach[] = [];
  const seenBreach = new Set<string>();
  let corpus = input.startCorpus;
  let worstBuffer = { amount: Infinity, month: 0, surplus: 0 };
  let totalPurchaseOutflow = 0;

  const flag = (breach: Breach) => {
    const key = `${breach.kind}:${breach.refId ?? ''}`;
    if (seenBreach.has(key)) return; // report the first occurrence only
    seenBreach.add(key);
    breaches.push(breach);
  };

  for (let m = 1; m <= horizon; m++) {
    // ---- inflow ---------------------------------------------------------
    const inflow =
      salaryAt(input, m) +
      sumActive(input.income.otherIncome, m) +
      bonusAt(input, m);

    // ---- outflow --------------------------------------------------------
    const fixed = sumActive(input.fixedExpenses, m);
    const variable =
      sumActive(input.variableExpenses, m) * Math.pow(1 + monthlyInflation, m - 1);
    const loanEmis = loanEmisAt(input, m);
    const freeCashflow = inflow - fixed - variable - loanEmis;

    const investments = sumActive(input.investments, m);

    // ---- purchases ------------------------------------------------------
    let purchaseEmis = 0;
    let ringFenced = 0;
    let lumpSums = 0;
    let potRefund = 0;

    for (const rt of runtimes) {
      const { plan } = rt;
      const start = plan.startMonth ?? 1;
      if (m < start) continue;

      switch (plan.mode) {
        case 'cash': {
          if (m === start) {
            lumpSums += plan.price;
            rt.cashPaid += plan.price;
            rt.purchased = true;
            rt.purchaseMonth = m;
          }
          break;
        }
        case 'emi':
        case 'down-payment-emi': {
          const down = plan.mode === 'down-payment-emi' ? (plan.downPayment ?? 0) : 0;
          if (m === start && down > 0) {
            lumpSums += down;
            rt.cashPaid += down;
          }
          if (m === start) {
            rt.purchased = true;
            rt.purchaseMonth = m;
          }
          const tenure = plan.emiTenure ?? 0;
          if (tenure > 0 && m >= start && m < start + tenure) {
            const emi = purchaseEmiAmount(plan);
            purchaseEmis += emi;
            rt.cashPaid += emi;
          }
          break;
        }
        case 'save-then-buy': {
          if (rt.purchased) break;
          const saving = plan.monthlySaving ?? 0;
          ringFenced += saving;
          rt.pot += saving;
          if (rt.pot >= plan.price) {
            rt.pot -= plan.price;
            rt.cashPaid += plan.price;
            rt.purchased = true;
            rt.purchaseMonth = m;
            // Whatever the ring-fence over-collected returns to the corpus.
            potRefund += rt.pot;
            rt.pot = 0;
          }
          break;
        }
      }
    }

    const surplus =
      freeCashflow - investments - purchaseEmis - ringFenced;

    // ---- corpus ---------------------------------------------------------
    corpus = corpus * (1 + monthlyReturn) + surplus - lumpSums + potRefund;
    totalPurchaseOutflow += lumpSums + purchaseEmis;

    // ---- goals ----------------------------------------------------------
    // Growth first, then this month's contributions.
    for (const goal of goalConfigs) {
      const rate = (goal.expectedReturnPct ?? 0) / 12 / 100;
      if (rate !== 0) {
        balances.set(goal.id, (balances.get(goal.id) ?? 0) * (1 + rate));
      }
    }

    // Required is the run-rate fixed at setup ((target - current) / months to
    // deadline), not a figure that re-bases every month - otherwise the buffer
    // moves for reasons the user never sees. It drops to 0 once the goal lands,
    // is marked done, or passes the month you said you would stop paying in.
    const required = new Map<string, number>();
    const funding: GoalConfig[] = [];
    for (const goal of goalConfigs) {
      const full = (balances.get(goal.id) ?? 0) >= goal.target;
      const stopped =
        goal.contributeUntilMonth != null && m > goal.contributeUntilMonth;
      const takes = !full && !stopped && !goal.isDone;

      required.set(goal.id, takes ? (runRates.get(goal.id) ?? 0) : 0);
      if (takes) funding.push(goal);
    }

    const available = Math.max(0, surplus);
    const contributions = new Map<string, number>();
    const capacity = new Map<string, number>();

    // Only goals still being funded compete for the surplus. A finished one
    // keeps its balance and stops absorbing money.
    const shared = allocate(
      funding,
      balances,
      required,
      available,
      allocationMode,
    );
    for (const goal of goalConfigs) {
      const add = (contributions.get(goal.id) ?? 0) + (shared.given.get(goal.id) ?? 0);
      contributions.set(goal.id, add);
      capacity.set(
        goal.id,
        (capacity.get(goal.id) ?? 0) + (shared.capacity.get(goal.id) ?? 0),
      );
      balances.set(goal.id, (balances.get(goal.id) ?? 0) + add);
    }

    // A lump sum comes out of real money, so the goal buckets holding that
    // money must shrink too - lowest priority first, protected goals last.
    if (lumpSums > 0) {
      debitGoals(goalConfigs, balances, lumpSums, (goal) => {
        // Drawing on a protected goal is normal - the money has to come from
        // somewhere. It is only worth flagging once you are net worse off than
        // the day you started. The hard line is the emergency floor, below.
        const balance = balances.get(goal.id) ?? 0;
        if (goal.isProtected && balance < goal.current) {
          flag({
            kind: 'protected-goal-raided',
            severity: 'amber',
            month: m,
            refId: goal.id,
            message: `You dip into ${goal.name}. It drops to ${fmt(balance)}, less than the ${fmt(goal.current)} you have today.`,
          });
        }
      });
    }

    // ---- record + flags --------------------------------------------------
    const goalStates: GoalMonthState[] = goalConfigs.map((goal) => ({
      goalId: goal.id,
      balance: balances.get(goal.id) ?? 0,
      contribution: contributions.get(goal.id) ?? 0,
      required: required.get(goal.id) ?? 0,
    }));

    for (const goal of goalConfigs) {
      if (completion.has(goal.id)) continue;
      const balance = balances.get(goal.id) ?? 0;
      if (balance >= goal.target) {
        const prev = months.at(-1)?.goals.find((g) => g.goalId === goal.id)?.balance
          ?? goal.current;
        // Interpolate on capacity, not on the contribution actually credited:
        // the final contribution is clipped at the target, which would round
        // every completion up to a whole month.
        const step = capacity.get(goal.id) ?? balance - prev;
        const frac = step > 0 ? (m - 1) + (goal.target - prev) / step : m;
        completion.set(goal.id, Math.max(0, frac));
      }
    }

    const totalRequired = goalConfigs.reduce(
      (sum, goal) => sum + (required.get(goal.id) ?? 0),
      0,
    );
    const buffer = surplus - totalRequired;
    if (buffer < worstBuffer.amount) {
      worstBuffer = { amount: buffer, month: m, surplus };
    }

    if (surplus < 0) {
      flag({
        kind: 'negative-surplus',
        severity: 'red',
        month: m,
        message: `You spend more than you earn — short by ${fmt(Math.abs(surplus))} that month.`,
      });
    }
    if (corpus < input.emergencyFloor) {
      flag({
        kind: 'corpus-below-floor',
        severity: 'red',
        month: m,
        message: `Your savings fall to ${fmt(corpus)}, below the ${fmt(input.emergencyFloor)} you said you would never go under.`,
      });
    }
    if (inflow > 0 && (loanEmis + purchaseEmis) / inflow > EMI_LOAD_LIMIT) {
      flag({
        kind: 'emi-load-high',
        severity: 'amber',
        month: m,
        message: `EMIs eat ${Math.round(((loanEmis + purchaseEmis) / inflow) * 100)}% of everything you earn. Over ${EMI_LOAD_LIMIT * 100}% is a lot.`,
      });
    }

    months.push({
      month: m,
      inflow,
      fixed,
      variable,
      loanEmis,
      freeCashflow,
      investments,
      purchaseEmis,
      ringFenced,
      surplus,
      lumpSums,
      corpus,
      buffer,
      goals: goalStates,
    });
  }

  // ---- outcomes ---------------------------------------------------------
  const goals: GoalOutcome[] = goalConfigs.map((goal) => {
    const completionMonth = completion.get(goal.id) ?? null;
    const missedDeadline =
      goal.deadlineMonth != null &&
      (completionMonth == null || completionMonth > goal.deadlineMonth);
    if (missedDeadline) {
      flag({
        kind: 'goal-missed-deadline',
        severity: 'amber',
        month: goal.deadlineMonth!,
        refId: goal.id,
        message:
          completionMonth == null
            ? `${goal.name} never reaches ${fmt(goal.target)} in the next ${horizon} months.`
            : `${goal.name} arrives about ${(completionMonth - goal.deadlineMonth!).toFixed(1)} months late.`,
      });
    }
    return {
      goalId: goal.id,
      name: goal.name,
      target: goal.target,
      completionMonth,
      finalBalance: balances.get(goal.id) ?? 0,
      deadlineMonth: goal.deadlineMonth,
      missedDeadline,
    };
  });

  for (const rt of runtimes) {
    if (rt.plan.mode === 'save-then-buy' && !rt.purchased) {
      flag({
        kind: 'purchase-unfunded',
        severity: 'amber',
        month: horizon,
        refId: rt.plan.id,
        message: `Saving ${fmt(rt.plan.monthlySaving ?? 0)} a month never adds up to ${fmt(rt.plan.price)} for ${rt.plan.name} — not within ${horizon} months.`,
      });
    }
    if (rt.plan.mode === 'save-then-buy' && rt.purchased) {
      totalPurchaseOutflow += rt.plan.price;
    }
  }

  return {
    horizonMonths: horizon,
    months,
    goals,
    breaches: breaches.sort((a, b) => a.month - b.month),
    worstBuffer:
      worstBuffer.amount === Infinity
        ? { amount: 0, month: 0, surplus: 0 }
        : worstBuffer,
    totalPurchaseOutflow,
  };
}

interface Allocation {
  /** What each goal is actually credited, clipped at its target. */
  given: Map<string, number>;
  /** What it would have been credited if the target were not in the way. */
  capacity: Map<string, number>;
}

/** Splits one month's surplus across goals. */
function allocate(
  goals: GoalConfig[],
  balances: Map<string, number>,
  required: Map<string, number>,
  available: number,
  mode: EngineInput['allocationMode'],
): Allocation {
  const given = new Map<string, number>();
  const capacity = new Map<string, number>();
  let left = available;
  if (left <= 0) return { given, capacity };

  const need = (goal: GoalConfig) =>
    Math.max(0, goal.target - (balances.get(goal.id) ?? 0));

  if (mode === 'fixed') {
    for (const goal of goals) {
      const want = goal.fixedContribution ?? required.get(goal.id) ?? 0;
      capacity.set(goal.id, Math.min(want, left));
      const give = Math.min(want, need(goal), left);
      given.set(goal.id, give);
      left -= give;
    }
    return { given, capacity };
  }

  if (mode === 'proportional') {
    const totalWeight = goals.reduce(
      (sum, goal) => (need(goal) > 0 ? sum + (goal.weight ?? 1) : sum),
      0,
    );
    if (totalWeight === 0) return { given, capacity };
    for (const goal of goals) {
      if (need(goal) <= 0) continue;
      const share = (available * (goal.weight ?? 1)) / totalWeight;
      capacity.set(goal.id, Math.min(share, left));
      const give = Math.min(share, need(goal), left);
      given.set(goal.id, give);
      left -= give;
    }
    return { given, capacity };
  }

  // waterfall (default): fill goal 1 to target, spill to goal 2.
  for (const goal of goals) {
    capacity.set(goal.id, Math.max(0, left));
    const give = Math.min(need(goal), left);
    given.set(goal.id, give);
    left -= give;
  }
  return { given, capacity };
}

/** Debits `amount` from goal buckets, lowest priority first, protected last. */
function debitGoals(
  goals: GoalConfig[],
  balances: Map<string, number>,
  amount: number,
  onDebit: (goal: GoalConfig, amount: number) => void,
): void {
  const order = [...goals].sort((a, b) => {
    if (!!a.isProtected !== !!b.isProtected) return a.isProtected ? 1 : -1;
    return b.priority - a.priority; // lowest priority (highest rank number) first
  });
  let left = amount;
  for (const goal of order) {
    if (left <= 0) break;
    const balance = balances.get(goal.id) ?? 0;
    const take = Math.min(balance, left);
    if (take <= 0) continue;
    balances.set(goal.id, balance - take);
    left -= take;
    onDebit(goal, take);
  }
}

function fmt(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}
