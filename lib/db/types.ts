/** Row shapes, snake_case to match Postgres exactly. */

export type BonusMode = 'lump' | 'amortised';
export type AllocationMode = 'waterfall' | 'fixed' | 'proportional';
export type ExpenseType = 'fixed' | 'variable' | 'investment';
export type PurchaseMode = 'cash' | 'emi' | 'down-payment-emi' | 'save-then-buy';
export type WishlistStatus =
  | 'idea'
  | 'planned'
  | 'committed'
  | 'purchased'
  | 'dropped';

export interface ProfileRow {
  id: string;
  name: string;
  currency: string;
  fiscal_month_start: number;
  pay_date: number;
  liquid_corpus: number;
  emergency_floor: number;
  annual_return_pct: number;
  annual_inflation_pct: number;
  bonus_mode: BonusMode;
  allocation_mode: AllocationMode;
  horizon_months: number;
  setup_complete: boolean;
  /**
   * How many onboarding steps are finished. See lib/onboarding.ts — a count
   * rather than a slug, so reordering the steps cannot strand anyone mid-way.
   */
  onboarding_step: number;
}

export interface IncomeRow {
  id: string;
  type: 'salary' | 'bonus' | 'other';
  label: string;
  amount: number;
  frequency: 'monthly' | 'annual';
  bonus_month: number | null;
  effective_from: string;
  effective_to: string | null;
}

export interface ExpenseItemRow {
  id: string;
  name: string;
  category: string;
  /** The amount billed each time, not per month. See `frequency_months`. */
  amount: number;
  type: ExpenseType;
  is_budget: boolean;
  /** 1 = monthly, 3 = quarterly, 6 = half-yearly, 12 = yearly. */
  frequency_months: number;
  /** When set, this is charged to a card and leaves your bank with that bill. */
  paid_by_card_id: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
}

export interface TransactionRow {
  id: string;
  date: string;
  amount: number;
  category: string;
  note: string | null;
  /**
   * Everything is 'manual' now. 'import' survives for rows written by the CSV
   * importer, which was removed: it had no dedupe, so re-importing a statement
   * silently doubled a month. Export replaced it.
   */
  source: 'manual' | 'import';
  /** When set, this went on that card and leaves your bank on the due date. */
  paid_by_card_id: string | null;
  is_one_off: boolean;
}

export interface LoanRow {
  id: string;
  name: string;
  type:
    | 'education'
    | 'personal'
    | 'home'
    | 'vehicle'
    | 'consumer-emi'
    | 'no-cost-emi'
    | 'other';
  principal: number;
  outstanding: number;
  annual_rate_pct: number;
  emi: number;
  tenure_months: number;
  start_date: string;
  due_day: number;
  is_no_cost: boolean;
  cash_discount: number;
  processing_fee: number;
  notional_rate_pct: number;
}

export interface CreditCardRow {
  id: string;
  name: string;
  credit_limit: number;
  statement_day: number;
  due_day: number;
  current_bill: number;
}

export type GoalStatus = 'active' | 'done';

export interface GoalRow {
  id: string;
  name: string;
  target: number;
  current_amount: number;
  deadline: string | null;
  /** 'done' = finished with by hand. Takes no further contributions. */
  status: GoalStatus;
  /**
   * Last month this goal is funded, whether or not it reached its target. Null
   * means keep funding it until it is full.
   */
  contribute_until: string | null;
  /**
   * Treat the target date as the last month funded, so the two never drift
   * apart when the target date moves. The earlier of this and
   * `contribute_until` wins.
   */
  stop_at_deadline: boolean;
  priority: number;
  expected_return_pct: number;
  is_protected: boolean;
  fixed_contribution: number | null;
  weight: number;
}

export interface WishlistItemRow {
  id: string;
  name: string;
  category: string;
  price: number;
  priority: number;
  target_date: string | null;
  reason: string | null;
  purchase_mode: PurchaseMode;
  emi_amount: number | null;
  emi_tenure: number | null;
  down_payment: number | null;
  monthly_saving: number | null;
  annual_rate_pct: number;
  is_no_cost: boolean;
  status: WishlistStatus;
  purchase_month: number | null;
}

export interface MonthlySnapshotRow {
  id: string;
  month: string;
  corpus: number;
  net_worth: number;
  surplus: number;
  savings_rate: number;
  total_inflow: number;
  total_outflow: number;
}

export interface ScenarioRow {
  id: string;
  name: string;
  item_ids: string[];
}

/** Everything the engine needs, in one read. */
export interface Snapshot {
  profile: ProfileRow;
  income: IncomeRow[];
  expenses: ExpenseItemRow[];
  loans: LoanRow[];
  goals: GoalRow[];
  wishlist: WishlistItemRow[];
  cards: CreditCardRow[];
  scenarios: ScenarioRow[];
  snapshots: MonthlySnapshotRow[];
}

export type TableName =
  | 'profile'
  | 'income'
  | 'expense_item'
  | 'transaction'
  | 'loan'
  | 'credit_card'
  | 'goal'
  | 'goal_contribution'
  | 'wishlist_item'
  | 'scenario'
  | 'simulation_run'
  | 'monthly_snapshot'
  | 'career_entry';
