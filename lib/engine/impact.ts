import { purchaseEmiAmount, simulate } from './simulate';
import type {
  Breach,
  EngineInput,
  PurchaseMode,
  PurchasePlan,
  SimulationResult,
} from './types';

export type Confidence = 'high' | 'medium' | 'low';

export interface GoalDelay {
  goalId: string;
  name: string;
  baselineMonth: number | null;
  scenarioMonth: number | null;
  /** Positive = the purchase pushes the goal out. null = never hit either way. */
  delayMonths: number | null;
  deadlineMonth?: number;
  /** True when the goal was fine before this purchase and misses now. */
  newlyMissesDeadline: boolean;
}

export interface CheckpointRow {
  month: number;
  baselineCorpus: number;
  scenarioCorpus: number;
  corpusDelta: number;
  goals: {
    goalId: string;
    name: string;
    baselineBalance: number;
    scenarioBalance: number;
    delta: number;
  }[];
}

export interface ImpactResult {
  baseline: SimulationResult;
  scenario: SimulationResult;
  /** The headline: which goal slips, and by how much. */
  headlineDelay: GoalDelay | null;
  goalDelays: GoalDelay[];
  checkpoints: CheckpointRow[];
  /** Breaches present in the scenario that the baseline did not have. */
  newBreaches: Breach[];
  totalCost: number;
  confidence: {
    level: Confidence;
    /** Worst-month buffer as a share of that month's surplus. */
    bufferPct: number;
    worstMonth: number;
    worstBuffer: number;
  };
  /**
   * Months to wait before the purchase stops causing a red breach.
   * 0 = safe today. null = still breaching even after `maxDelay` months.
   */
  earliestSafeDelay: number | null;
  headline: string;
}

const DEFAULT_CHECKPOINTS = [3, 6, 9, 12];

function shiftItems(items: PurchasePlan[], delay: number): PurchasePlan[] {
  return items.map((item) => ({
    ...item,
    startMonth: (item.startMonth ?? 1) + delay,
  }));
}

function redBreaches(result: SimulationResult): Breach[] {
  return result.breaches.filter((b) => b.severity === 'red');
}

function breachKey(b: Breach): string {
  return `${b.kind}:${b.refId ?? ''}`;
}

function confidenceFrom(worst: {
  amount: number;
  month: number;
  surplus: number;
}): ImpactResult['confidence'] {
  // Deterministic, not a vibes percentage: how much room is left in the
  // tightest month of the simulation, as a share of that month's surplus.
  const pct = worst.surplus > 0 ? worst.amount / worst.surplus : -1;
  const level: Confidence = pct > 0.25 ? 'high' : pct >= 0.1 ? 'medium' : 'low';
  return {
    level,
    bufferPct: pct,
    worstMonth: worst.month,
    worstBuffer: worst.amount,
  };
}

/**
 * Runs the simulation twice - baseline (committed items only) and scenario
 * (baseline + the items being evaluated) - and returns the diff.
 */
export function evaluatePurchase(
  input: EngineInput,
  candidates: PurchasePlan[],
  options?: { checkpoints?: number[]; maxDelay?: number },
): ImpactResult {
  const checkpoints = options?.checkpoints ?? DEFAULT_CHECKPOINTS;
  const maxDelay = options?.maxDelay ?? 24;
  const committed = input.purchases ?? [];

  const baseline = simulate({ ...input, purchases: committed });
  const scenario = simulate({
    ...input,
    purchases: [...committed, ...candidates],
  });

  const goalDelays: GoalDelay[] = baseline.goals.map((base) => {
    const scen = scenario.goals.find((g) => g.goalId === base.goalId);
    const delayMonths =
      base.completionMonth != null && scen?.completionMonth != null
        ? scen.completionMonth - base.completionMonth
        : null;
    return {
      goalId: base.goalId,
      name: base.name,
      baselineMonth: base.completionMonth,
      scenarioMonth: scen?.completionMonth ?? null,
      delayMonths,
      deadlineMonth: base.deadlineMonth,
      newlyMissesDeadline: !base.missedDeadline && !!scen?.missedDeadline,
    };
  });

  const headlineDelay =
    goalDelays
      .filter((g) => g.delayMonths != null || g.newlyMissesDeadline)
      .sort((a, b) => (b.delayMonths ?? Infinity) - (a.delayMonths ?? Infinity))[0]
    ?? goalDelays[0]
    ?? null;

  const checkpointRows: CheckpointRow[] = checkpoints
    .filter((m) => m <= baseline.horizonMonths)
    .map((m) => {
      const b = baseline.months[m - 1];
      const s = scenario.months[m - 1];
      return {
        month: m,
        baselineCorpus: b.corpus,
        scenarioCorpus: s.corpus,
        corpusDelta: s.corpus - b.corpus,
        goals: b.goals.map((bg) => {
          const sg = s.goals.find((g) => g.goalId === bg.goalId);
          const goal = baseline.goals.find((g) => g.goalId === bg.goalId);
          return {
            goalId: bg.goalId,
            name: goal?.name ?? bg.goalId,
            baselineBalance: bg.balance,
            scenarioBalance: sg?.balance ?? 0,
            delta: (sg?.balance ?? 0) - bg.balance,
          };
        }),
      };
    });

  const baselineKeys = new Set(baseline.breaches.map(breachKey));
  const newBreaches = scenario.breaches.filter(
    (b) => !baselineKeys.has(breachKey(b)),
  );

  const totalCost =
    scenario.totalPurchaseOutflow - baseline.totalPurchaseOutflow;

  // Earliest safe date: how long until this stops causing a red breach?
  let earliestSafeDelay: number | null = null;
  const baselineRedKeys = new Set(redBreaches(baseline).map(breachKey));
  for (let delay = 0; delay <= maxDelay; delay++) {
    const run =
      delay === 0
        ? scenario
        : simulate({
            ...input,
            purchases: [...committed, ...shiftItems(candidates, delay)],
          });
    const hasNewRed = redBreaches(run).some(
      (b) => !baselineRedKeys.has(breachKey(b)),
    );
    if (!hasNewRed) {
      earliestSafeDelay = delay;
      break;
    }
  }

  const confidence = confidenceFrom(scenario.worstBuffer);

  return {
    baseline,
    scenario,
    headlineDelay,
    goalDelays,
    checkpoints: checkpointRows,
    newBreaches,
    totalCost,
    confidence,
    earliestSafeDelay,
    headline: buildHeadline({
      headlineDelay,
      newBreaches,
      totalCost,
      confidence,
      earliestSafeDelay,
    }),
  };
}

function buildHeadline(parts: {
  headlineDelay: GoalDelay | null;
  newBreaches: Breach[];
  totalCost: number;
  confidence: ImpactResult['confidence'];
  earliestSafeDelay: number | null;
}): string {
  const { headlineDelay, newBreaches, totalCost, confidence } = parts;
  const hasRed = newBreaches.some((b) => b.severity === 'red');
  const delays = (headlineDelay?.delayMonths ?? 0) >= 0.05;
  const light = hasRed
    ? '🔴'
    : newBreaches.length > 0 || delays
      ? '🟡'
      : '🟢';

  let core: string;
  if (!headlineDelay) {
    core = 'This does not push back anything you are saving for.';
  } else if (headlineDelay.delayMonths == null) {
    core = `You would not finish saving for ${headlineDelay.name} either way.`;
  } else if (headlineDelay.delayMonths < 0.05) {
    core = `Your ${headlineDelay.name} still arrives on time.`;
  } else {
    core = `This pushes your ${headlineDelay.name} back by ${headlineDelay.delayMonths.toFixed(1)} months.`;
  }

  const cost = `It costs ₹${Math.round(totalCost).toLocaleString('en-IN')} in total.`;
  const safety =
    confidence.level === 'high'
      ? 'Comfortable.'
      : confidence.level === 'medium'
        ? 'A bit tight.'
        : 'Very tight.';
  return `${light} ${core} ${cost} ${safety}`;
}

export interface ModeComparisonRow {
  mode: PurchaseMode;
  label: string;
  /** Total rupees paid out over the horizon for this item. */
  totalPaid: number;
  monthlyOutflow: number;
  /** Delay on the headline goal, in months. */
  goalDelayMonths: number | null;
  /** Lowest the corpus ever gets. Cash mode wins on cost and loses here. */
  lowestCorpus: number;
  /** Month the item is actually owned. */
  ownedInMonth: number | null;
  redBreaches: number;
  amberBreaches: number;
  confidence: Confidence;
  feasible: boolean;
}

/**
 * Same item, all four purchase modes, side by side. EMI often wins on goal
 * delay and loses on total cost - show both and let the user choose.
 */
export function compareModes(
  input: EngineInput,
  item: PurchasePlan,
  options?: { tenure?: number; downPaymentPct?: number; ratePct?: number },
): ModeComparisonRow[] {
  const tenure = options?.tenure ?? item.emiTenure ?? 6;
  const rate = options?.ratePct ?? item.annualRatePct ?? 0;
  const down =
    item.downPayment ?? Math.round(item.price * (options?.downPaymentPct ?? 0.25));

  const variants: { mode: PurchaseMode; label: string; plan: PurchasePlan }[] = [
    {
      mode: 'cash',
      label: 'Pay it all now',
      plan: { ...item, mode: 'cash' },
    },
    {
      mode: 'emi',
      label: `EMI for ${tenure} months`,
      plan: {
        ...item,
        mode: 'emi',
        emiTenure: tenure,
        annualRatePct: rate,
        downPayment: 0,
        emiAmount: undefined,
      },
    },
    {
      mode: 'down-payment-emi',
      label: `Pay ₹${Math.round(down).toLocaleString('en-IN')} upfront, rest on EMI`,
      plan: {
        ...item,
        mode: 'down-payment-emi',
        downPayment: down,
        emiTenure: tenure,
        annualRatePct: rate,
        emiAmount: undefined,
      },
    },
    {
      mode: 'save-then-buy',
      label: `Save ₹${Math.round(item.price / tenure).toLocaleString('en-IN')} a month, buy later`,
      plan: {
        ...item,
        mode: 'save-then-buy',
        monthlySaving: item.monthlySaving ?? item.price / tenure,
      },
    },
  ];

  return variants.map(({ mode, label, plan }) => {
    const result = evaluatePurchase(input, [plan]);
    const delay = result.headlineDelay?.delayMonths ?? null;
    const owned =
      result.scenario.months.find(
        (m) => m.lumpSums > 0 || m.purchaseEmis > 0 || m.ringFenced > 0,
      ) != null
        ? ownedMonth(result.scenario, plan)
        : null;
    const emi =
      plan.mode === 'save-then-buy'
        ? (plan.monthlySaving ?? 0)
        : purchaseEmiAmount(plan);

    return {
      mode,
      label,
      totalPaid: result.totalCost,
      monthlyOutflow: plan.mode === 'cash' ? 0 : emi,
      goalDelayMonths: delay,
      lowestCorpus: Math.min(...result.scenario.months.map((m) => m.corpus)),
      ownedInMonth: owned,
      redBreaches: result.newBreaches.filter((b) => b.severity === 'red').length,
      amberBreaches: result.newBreaches.filter((b) => b.severity === 'amber').length,
      confidence: result.confidence.level,
      feasible: !result.newBreaches.some((b) => b.severity === 'red'),
    };
  });
}

function ownedMonth(result: SimulationResult, plan: PurchasePlan): number | null {
  const start = plan.startMonth ?? 1;
  if (plan.mode !== 'save-then-buy') return start;
  const saving = plan.monthlySaving ?? 0;
  if (saving <= 0) return null;
  const months = Math.ceil(plan.price / saving);
  const owned = start + months - 1;
  return owned <= result.horizonMonths ? owned : null;
}
