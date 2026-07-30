import { bonusAt, isDue, simulate } from './simulate';
import type { EngineInput, LoanLine, MonthState, RecurringLine } from './types';

export interface WaterfallRow {
  label: string;
  amount: number;
  kind: 'inflow' | 'outflow' | 'subtotal';
}

export interface Waterfall {
  totalInflow: number;
  fixed: number;
  committedDebt: number;
  variable: number;
  freeCashflow: number;
  committedInvestments: number;
  wishlistEmis: number;
  /** The number the whole app revolves around. */
  investableSurplus: number;
  /** Surplus as a share of total inflow. */
  surplusRate: number;
  /** What goals took out of the surplus this month. */
  goalContributions: number;
  /** Surplus after goals have taken their share. */
  balanceLeft: number;
  rows: WaterfallRow[];
}

/** The cashflow waterfall for a single month (default: the month ahead). */
export function buildWaterfall(input: EngineInput, month = 1): Waterfall {
  const result = simulate({ ...input, horizonMonths: Math.max(month, 1) });
  const m: MonthState = result.months[month - 1];
  return waterfallFromMonth(m);
}

export function waterfallFromMonth(m: MonthState): Waterfall {
  const wishlistEmis = m.purchaseEmis + m.ringFenced;
  // Goals are funded out of the surplus, so the waterfall does not end there —
  // the number that matters is what survives them.
  //
  // Required, not actual: in waterfall mode the allocator sweeps every spare
  // rupee into the goals it can still fill, which would leave this at zero and
  // say nothing. What the required contributions leave behind is the figure the
  // rest of the app quotes as the balance.
  const goalContributions = m.goals.reduce((sum, g) => sum + g.required, 0);
  const balanceLeft = m.buffer;

  const rows: WaterfallRow[] = [
    { label: 'Income', amount: m.inflow, kind: 'inflow' },
    { label: 'Fixed expenses', amount: -m.fixed, kind: 'outflow' },
    { label: 'Loan EMIs', amount: -m.loanEmis, kind: 'outflow' },
    { label: 'Variable expenses', amount: -m.variable, kind: 'outflow' },
    { label: 'Available', amount: m.freeCashflow, kind: 'subtotal' },
    { label: 'Savings & investments', amount: -m.investments, kind: 'outflow' },
    { label: 'Wishlist commitments', amount: -wishlistEmis, kind: 'outflow' },
    { label: 'Monthly surplus', amount: m.surplus, kind: 'subtotal' },
    { label: 'Goal contributions', amount: -goalContributions, kind: 'outflow' },
    { label: 'Balance left', amount: balanceLeft, kind: 'subtotal' },
  ];

  return {
    goalContributions,
    balanceLeft,
    totalInflow: m.inflow,
    fixed: m.fixed,
    committedDebt: m.loanEmis,
    variable: m.variable,
    freeCashflow: m.freeCashflow,
    committedInvestments: m.investments,
    wishlistEmis,
    investableSurplus: m.surplus,
    surplusRate: m.inflow > 0 ? m.surplus / m.inflow : 0,
    rows,
  };
}

export interface PlanningTotals {
  income: number;
  /** Rent, bills and anything else that does not move. */
  fixed: number;
  /** Budgeted everyday spending. */
  variable: number;
  /** Savings lines: SIPs, deposits, retirement. */
  investments: number;
  loanEmis: number;
  /** income − fixed − variable − loans. What there is to allocate. */
  available: number;
  /** available − investments. What is genuinely spare. */
  spare: number;
  /**
   * Lines dated to start after this month, at what they will be billed.
   * Excluded from every figure above — a subscription starting in September is
   * not part of July's budget — but worth showing, because "why is my rent
   * missing?" has to have an answer.
   */
  upcoming: {
    fixed: number;
    variable: number;
    investments: number;
    loanEmis: number;
    total: number;
  };
  /**
   * Running lines that are simply not billed this month: the half-yearly gym in
   * the five months between renewals. Not an outgoing now and not upcoming
   * either — the row exists and is running, it just costs nothing this month.
   *
   * Kept separate so the balance card can say why a line it knows about is
   * missing from the total, and so nobody reads the quiet month as free money.
   */
  notDueThisMonth: number;
}

/**
 * Is this line running in the month being planned?
 *
 * That month is month 1 — the first full month ahead, the same one the
 * simulation and the cashflow card use. Planning the month already half spent
 * would answer a question nobody is asking, and would put these figures at odds
 * with the projection they sit next to.
 */
function inEffect(line: RecurringLine): boolean {
  const begins = line.beginsMonth ?? line.fromMonth ?? 1;
  const ends = line.toMonth ?? Infinity;
  return begins <= 1 && ends >= 1;
}

/** Dated to start after the month being planned, as opposed to finished. */
function startsLater(line: RecurringLine): boolean {
  return (line.beginsMonth ?? line.fromMonth ?? 1) > 1;
}

/** Full billed amounts, not monthly equivalents. See `planningTotals`. */
function sumAmounts(lines: RecurringLine[] | undefined): number {
  if (!lines) return 0;
  return lines.reduce((total, line) => total + line.amount, 0);
}

/**
 * What this month actually costs, as opposed to what an average month costs.
 *
 * A ₹9,000 gym billed every six months is ₹9,000 in the month it renews and
 * nothing in the other five. It used to be ₹1,500 every month here, on the
 * argument that a smoothed number is the one you budget against — but that
 * number only describes somebody who sets ₹1,500 aside, and the money does not
 * leave that way. The renewal is paid in one go out of that month's salary, so
 * that is the month it is charged.
 *
 * The cost of this is a figure that moves: five roomy months and one tight one,
 * where before there were six identical ones. `notDueThisMonth` exists so the
 * roomy months can say what is coming rather than looking like a windfall, and
 * the projection table remains the place to see the whole run at once.
 */
export function planningTotals(input: EngineInput): PlanningTotals {
  // Billed this month, in full — the same test the simulation applies to month
  // 1, so the header and the cashflow card cannot disagree about a renewal.
  const dueNow = (line: RecurringLine) => inEffect(line) && isDue(line, 1);
  const runningButNotDue = (line: RecurringLine) =>
    inEffect(line) && !isDue(line, 1);

  const income =
    input.income.netSalary +
    sumAmounts(input.income.otherIncome?.filter(dueNow)) +
    bonusAt(input, 1);

  // Only what is actually running this month. Counting a line dated to start in
  // September against July's income overstates the outgoings all year.
  const fixed = sumAmounts(input.fixedExpenses?.filter(dueNow));
  const variable = sumAmounts(input.variableExpenses?.filter(dueNow));
  const investments = sumAmounts((input.investments ?? []).filter(dueNow));

  const notDueThisMonth = [
    ...(input.fixedExpenses ?? []),
    ...(input.variableExpenses ?? []),
    ...(input.investments ?? []),
  ]
    .filter(runningButNotDue)
    .reduce((total, line) => total + line.amount, 0);

  const upcomingFixed = sumAmounts(input.fixedExpenses?.filter(startsLater));
  const upcomingVariable = sumAmounts(input.variableExpenses?.filter(startsLater));
  const upcomingInvestments = sumAmounts(
    (input.investments ?? []).filter(startsLater),
  );

  // A loan drawn down in January is not costing anything in August. The
  // simulation always charged it from its start month; this did not.
  const loanRunning = (loan: LoanLine) => {
    if (loan.remainingMonths <= 0) return false;
    const start = loan.startMonth ?? 1;
    return start <= 1 && start + loan.remainingMonths - 1 >= 1;
  };
  const loanStartsLater = (loan: LoanLine) =>
    loan.remainingMonths > 0 && (loan.startMonth ?? 1) > 1;

  const loanEmis = (input.loans ?? [])
    .filter(loanRunning)
    .reduce((total, loan) => total + loan.emi, 0);
  const upcomingLoanEmis = (input.loans ?? [])
    .filter(loanStartsLater)
    .reduce((total, loan) => total + loan.emi, 0);

  const available = income - fixed - variable - loanEmis;
  return {
    income,
    fixed,
    variable,
    investments,
    loanEmis,
    available,
    spare: available - investments,
    upcoming: {
      fixed: upcomingFixed,
      variable: upcomingVariable,
      investments: upcomingInvestments,
      loanEmis: upcomingLoanEmis,
      total:
        upcomingFixed + upcomingVariable + upcomingInvestments + upcomingLoanEmis,
    },
    notDueThisMonth,
  };
}

export interface HealthSnapshot {
  investableSurplus: number;
  surplusRate: number;
  liquidCorpus: number;
  emergencyFloor: number;
  /** Corpus above (or below) the emergency floor. */
  floorHeadroom: number;
  /** Months of burn the corpus covers. */
  runwayMonths: number;
  monthlyBurn: number;
  /** One traffic light for "are all goals still on track". */
  goalHealth: 'good' | 'warn' | 'bad';
  goalHealthReason: string;
}

/** Dashboard hero numbers. Uses the committed-items-only baseline. */
export function healthSnapshot(input: EngineInput): HealthSnapshot {
  const result = simulate(input);
  const first = result.months[0];
  const wf = waterfallFromMonth(first);

  const monthlyBurn =
    first.fixed + first.variable + first.loanEmis + first.purchaseEmis;
  const runwayMonths = monthlyBurn > 0 ? input.startCorpus / monthlyBurn : Infinity;

  const red = result.breaches.filter((b) => b.severity === 'red');
  const amber = result.breaches.filter((b) => b.severity === 'amber');
  const goalHealth = red.length > 0 ? 'bad' : amber.length > 0 ? 'warn' : 'good';
  const goalHealthReason =
    red[0]?.message ??
    amber[0]?.message ??
    'Everything you are saving for is on schedule.';

  return {
    investableSurplus: wf.investableSurplus,
    surplusRate: wf.surplusRate,
    liquidCorpus: input.startCorpus,
    emergencyFloor: input.emergencyFloor,
    floorHeadroom: input.startCorpus - input.emergencyFloor,
    runwayMonths,
    monthlyBurn,
    goalHealth,
    goalHealthReason,
  };
}
