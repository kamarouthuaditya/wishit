/**
 * Engine domain types.
 *
 * The engine is deliberately date-free: everything is expressed in *month
 * offsets* where month 1 is the first full month after `startDate`. Mapping
 * real dates to offsets happens at the boundary (see lib/engine/period.ts), so
 * the simulation stays pure and trivially testable.
 */

/**
 * A line that recurs between `fromMonth` and `toMonth` inclusive.
 *
 * `everyMonths` handles things billed quarterly or yearly - a gym paid every 6
 * months is charged in full in its due month, not smoothed. That keeps the
 * simulation honest about the month the money actually leaves. Use
 * `monthlyEquivalent` when you want the smoothed figure for planning.
 */
export interface RecurringLine {
  id: string;
  name: string;
  amount: number;
  /** First month this line is active. Default 1. */
  fromMonth?: number;
  /** Last month this line is active. Omit for "forever". */
  toMonth?: number;
  /** Bill every N months. 1 = monthly, 3 = quarterly, 12 = yearly. Default 1. */
  everyMonths?: number;
  /**
   * Month the line actually starts, before `fromMonth` is walked forward to
   * land on a billing date. 0 or less means it is already running.
   *
   * `fromMonth` alone cannot answer "has this started yet": a yearly line that
   * began two years ago and one that begins in three months can both carry
   * `fromMonth: 3`. Planning needs the difference — a subscription starting
   * next month is not part of this month's budget.
   */
  beginsMonth?: number;
}

export interface SalaryStep {
  /** Month this salary level takes effect. */
  fromMonth: number;
  /** Net (in-hand) monthly amount. */
  amount: number;
}

export type BonusMode = 'lump' | 'amortised';

export interface IncomeConfig {
  /** Net in-hand salary today. */
  netSalary: number;
  /** Known future raises. Applied from `fromMonth` onward. */
  salarySteps?: SalaryStep[];
  /** Other recurring income (rent received, freelance retainer, ...). */
  otherIncome?: RecurringLine[];
  bonus?: {
    amount: number;
    /** Month offset the bonus lands in. Repeats every 12 months. */
    month: number;
  };
  /**
   * 'lump'      - bonus hits inflow in its actual month (makes "wait for the
   *               bonus" visible in earliest-safe-date output).
   * 'amortised' - bonus/12 added to every month.
   */
  bonusMode: BonusMode;
}

export type LoanType =
  | 'education'
  | 'personal'
  | 'home'
  | 'vehicle'
  | 'consumer-emi'
  | 'no-cost-emi'
  | 'other';

export interface LoanLine {
  id: string;
  name: string;
  type: LoanType;
  emi: number;
  /** First month the EMI is charged. Default 1. */
  startMonth?: number;
  /** How many EMIs remain from `startMonth` onward. */
  remainingMonths: number;
  /** Annual nominal rate, %. Only used by the amortisation helpers. */
  annualRatePct?: number;
  /** Outstanding principal today. Only used by the amortisation helpers. */
  outstanding?: number;
}

export type AllocationMode = 'waterfall' | 'fixed' | 'proportional';

export interface GoalConfig {
  id: string;
  name: string;
  target: number;
  /** Balance today. */
  current: number;
  /** Month offset the goal is due. Omit for "no deadline". */
  deadlineMonth?: number;
  /** 1 = highest. Drives waterfall order and who gets starved first. */
  priority: number;
  /** Annual return on this goal's balance, %. Default 0. */
  expectedReturnPct?: number;
  /** Protected goals are debited last when a lump sum must be funded. */
  isProtected?: boolean;
  /** Used by allocationMode 'fixed'. */
  fixedContribution?: number;
  /** Used by allocationMode 'proportional'. Default 1. */
  weight?: number;
  /**
   * Marked finished by hand. Keeps its balance, takes nothing further — the
   * money it was absorbing goes back to the surplus.
   */
  isDone?: boolean;
  /**
   * Last month this goal is funded, target reached or not. Omit to fund it
   * until it is full.
   */
  contributeUntilMonth?: number;
}

export type PurchaseMode =
  | 'cash'
  | 'emi'
  | 'down-payment-emi'
  | 'save-then-buy';

export type PurchaseStatus =
  | 'idea'
  | 'planned'
  | 'committed'
  | 'purchased'
  | 'dropped';

export interface PurchasePlan {
  id: string;
  name: string;
  /** Sticker price. */
  price: number;
  mode: PurchaseMode;
  /** Month the purchase starts (cash outflow / first EMI). Default 1. */
  startMonth?: number;
  /** EMI modes only. If omitted it is derived from price, rate and tenure. */
  emiAmount?: number;
  /** EMI modes only. */
  emiTenure?: number;
  /** 'down-payment-emi' only. Paid as a lump sum in `startMonth`. */
  downPayment?: number;
  /** Annual rate on the EMI, %. 0 for a genuine no-cost EMI. */
  annualRatePct?: number;
  /** 'save-then-buy' only: amount ring-fenced per month. */
  monthlySaving?: number;
}

export interface EngineInput {
  /** Months to simulate. Default 36. */
  horizonMonths?: number;
  /** Liquid corpus today. */
  startCorpus: number;
  /** Hard line. Corpus below this is a red breach, not a note. */
  emergencyFloor: number;
  /** Annual return on liquid corpus, %. Default 0. */
  annualReturnPct?: number;
  /** Annual drift applied to variable (budgeted) expenses, %. Default 0. */
  annualInflationPct?: number;
  income: IncomeConfig;
  /** Rent, home contribution, insurance, internet, subscriptions, petrol... */
  fixedExpenses?: RecurringLine[];
  /** Budgeted variable spend. Projections use budget, never actuals. */
  variableExpenses?: RecurringLine[];
  /** Committed investments (SIP, retirement). Subtracted after free cashflow. */
  investments?: RecurringLine[];
  loans?: LoanLine[];
  goals?: GoalConfig[];
  /** Purchases active in this run. Baseline runs get committed items only. */
  purchases?: PurchasePlan[];
  allocationMode?: AllocationMode;
}

export type BreachSeverity = 'red' | 'amber';

export type BreachKind =
  | 'corpus-below-floor'
  | 'negative-surplus'
  | 'goal-missed-deadline'
  | 'emi-load-high'
  | 'protected-goal-raided'
  | 'purchase-unfunded';

export interface Breach {
  kind: BreachKind;
  severity: BreachSeverity;
  /** First month the breach occurs. */
  month: number;
  message: string;
  /** Goal or purchase this breach belongs to, when applicable. */
  refId?: string;
}

export interface GoalMonthState {
  goalId: string;
  balance: number;
  contribution: number;
  /** Contribution needed this month to still hit the deadline. */
  required: number;
}

export interface MonthState {
  month: number;
  inflow: number;
  fixed: number;
  variable: number;
  loanEmis: number;
  freeCashflow: number;
  investments: number;
  purchaseEmis: number;
  ringFenced: number;
  /** The number the whole app revolves around. */
  surplus: number;
  lumpSums: number;
  corpus: number;
  /** surplus minus the sum of every goal's required contribution. */
  buffer: number;
  goals: GoalMonthState[];
}

export interface GoalOutcome {
  goalId: string;
  name: string;
  target: number;
  /** Fractional month the target is reached. null if not inside the horizon. */
  completionMonth: number | null;
  finalBalance: number;
  deadlineMonth?: number;
  missedDeadline: boolean;
}

export interface SimulationResult {
  horizonMonths: number;
  months: MonthState[];
  goals: GoalOutcome[];
  breaches: Breach[];
  /** Smallest `buffer` across the horizon, and where it happened. */
  worstBuffer: { amount: number; month: number; surplus: number };
  /** Total cash the purchases in this run consumed (lump sums + EMIs paid). */
  totalPurchaseOutflow: number;
}
