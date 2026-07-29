import { evaluatePurchase, simulate, type EngineInput } from '@/lib/engine';
import { toPurchasePlan } from '@/lib/model/to-engine';
import { buildActuals, budgetsByCategory } from '@/lib/model/actuals';
import type {
  ExpenseItemRow,
  MonthlySnapshotRow,
  Snapshot,
  TransactionRow,
} from '@/lib/db/types';
import { now as clockNow } from '@/lib/clock';

/**
 * Module 7 - the monthly review. This is how the model stays honest: projections
 * run on budgets, and once a month the budgets get checked against what actually
 * happened.
 */

export interface CategoryLine {
  category: string;
  type: ExpenseItemRow['type'] | 'uncategorised';
  budget: number;
  actual: number;
  /** actual - budget. Positive means overspent. */
  delta: number;
  /** The part of `actual` flagged one-off, which should not be extrapolated. */
  oneOff: number;
}

export interface GoalReviewLine {
  goalId: string;
  name: string;
  target: number;
  current: number;
  onTrack: boolean;
  completionMonth: number | null;
  deadlineMonth?: number;
  requiredMonthly: number;
}

export type AffordabilityChange = 'became-affordable' | 'slipped' | null;

export interface WishlistReviewLine {
  id: string;
  name: string;
  price: number;
  status: string;
  affordableNow: boolean;
  waitMonths: number | null;
  delayMonths: number | null;
  change: AffordabilityChange;
}

export interface ReviewResult {
  month: string;
  categories: CategoryLine[];
  totals: { budget: number; actual: number; delta: number; oneOff: number };
  inflow: number;
  plannedSurplus: number;
  /** Planned inflow less what was actually spent. */
  achievedSurplus: number;
  surplusDelta: number;
  /** Null until a transaction exists for the month. */
  hasActuals: boolean;
  goals: GoalReviewLine[];
  wishlist: WishlistReviewLine[];
  previous: MonthlySnapshotRow | null;
  corpusChange: number | null;
}

/**
 * Affordability is absolute, not relative to the baseline. `earliestSafeDelay`
 * only counts breaches the purchase *introduces*, so on a baseline that already
 * dips below the emergency floor every purchase would read as safe. Here the
 * question is simply: after buying this, does anything go red?
 */
function isAffordable(impact: {
  scenario: { breaches: { severity: string }[] };
}): boolean {
  return impact.scenario.breaches.every((b) => b.severity !== 'red');
}

function baselineHealthy(impact: {
  baseline: { breaches: { severity: string }[] };
}): boolean {
  return impact.baseline.breaches.every((b) => b.severity !== 'red');
}

function activeInMonth(row: ExpenseItemRow, month: string): boolean {
  const from = row.effective_from.slice(0, 7);
  const to = row.effective_to?.slice(0, 7);
  return from <= month && (to == null || to >= month);
}

export function buildReview(params: {
  snapshot: Snapshot;
  input: EngineInput;
  month: string;
  transactions: TransactionRow[];
  previous: MonthlySnapshotRow | null;
  /** Pinned in tests; the pace estimate depends on how far into the month it is. */
  now?: Date;
}): ReviewResult {
  const { snapshot, input, month, transactions, previous } = params;
  const now = params.now ?? clockNow();
  const prefix = month.slice(0, 7);

  // ---- budget vs actual, per category ---------------------------------
  const budgets = new Map<string, { amount: number; type: ExpenseItemRow['type'] }>();
  for (const row of snapshot.expenses) {
    if (!activeInMonth(row, prefix)) continue;
    const existing = budgets.get(row.category);
    budgets.set(row.category, {
      amount: (existing?.amount ?? 0) + Number(row.amount),
      type: existing?.type ?? row.type,
    });
  }

  const actuals = new Map<string, { amount: number; oneOff: number }>();
  for (const tx of transactions) {
    const existing = actuals.get(tx.category) ?? { amount: 0, oneOff: 0 };
    actuals.set(tx.category, {
      amount: existing.amount + Number(tx.amount),
      oneOff: existing.oneOff + (tx.is_one_off ? Number(tx.amount) : 0),
    });
  }

  const categories: CategoryLine[] = [
    ...new Set([...budgets.keys(), ...actuals.keys()]),
  ]
    .map((category) => {
      const budget = budgets.get(category)?.amount ?? 0;
      const actual = actuals.get(category)?.amount ?? 0;
      return {
        category,
        type: budgets.get(category)?.type ?? ('uncategorised' as const),
        budget,
        actual,
        delta: actual - budget,
        oneOff: actuals.get(category)?.oneOff ?? 0,
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const totals = categories.reduce(
    (acc, line) => ({
      budget: acc.budget + line.budget,
      actual: acc.actual + line.actual,
      delta: acc.delta + line.delta,
      oneOff: acc.oneOff + line.oneOff,
    }),
    { budget: 0, actual: 0, delta: 0, oneOff: 0 },
  );

  // ---- surplus planned vs achieved -------------------------------------
  const first = simulate({ ...input, horizonMonths: 1 }).months[0];
  const inflow = first.inflow;
  const plannedSurplus = first.surplus;

  /*
   * Achieved surplus used to be `inflow − everything logged`, which flattered
   * anyone who logs partially: one ₹400 coffee and the month looked as though
   * ₹400 had left. It now runs through the same estimator the dashboard and the
   * spending page use, where a category with no entries counts at its budget
   * and only what you actually recorded can beat it.
   */
  const estimate = buildActuals({
    transactions,
    budgets: budgetsByCategory(snapshot.expenses, prefix),
    month: prefix,
    now,
  });
  const achievedSurplus = inflow - estimate.projected;

  // ---- goals -----------------------------------------------------------
  const projection = simulate(input);
  const goals: GoalReviewLine[] = projection.goals.map((goal) => {
    const config = input.goals?.find((g) => g.id === goal.goalId);
    const requiredMonthly =
      config?.deadlineMonth && config.deadlineMonth > 0
        ? Math.max(0, config.target - config.current) / config.deadlineMonth
        : (config?.fixedContribution ?? 0);
    return {
      goalId: goal.goalId,
      name: goal.name,
      target: goal.target,
      current: config?.current ?? 0,
      onTrack: !goal.missedDeadline && goal.completionMonth != null,
      completionMonth: goal.completionMonth,
      deadlineMonth: goal.deadlineMonth,
      requiredMonthly,
    };
  });

  // ---- wishlist: what became affordable, what slipped -------------------
  const anchorItems = snapshot.wishlist.filter(
    (w) => w.status === 'idea' || w.status === 'planned',
  );

  const wishlist: WishlistReviewLine[] = anchorItems.map((item) => {
    const plan = toPurchasePlan(item, new Date());
    const now = evaluatePurchase(input, [plan], { maxDelay: 12 });
    const affordableNow = isAffordable(now);

    // The comparison is against a real recorded corpus, not a guess: if there
    // is no previous snapshot, there is no "changed" claim to make.
    let change: AffordabilityChange = null;
    if (previous) {
      const before = evaluatePurchase(
        { ...input, startCorpus: Number(previous.corpus) },
        [plan],
        { maxDelay: 12 },
      );
      const affordableBefore = isAffordable(before);
      if (affordableNow && !affordableBefore) change = 'became-affordable';
      else if (!affordableNow && affordableBefore) change = 'slipped';
    }

    return {
      id: item.id,
      name: item.name,
      price: Number(item.price),
      status: item.status,
      affordableNow,
      // Waiting only helps if the problem is the purchase. If the baseline is
      // already breaching, no delay fixes it and there is no honest number.
      waitMonths: affordableNow
        ? 0
        : baselineHealthy(now)
          ? now.earliestSafeDelay
          : null,
      delayMonths: now.headlineDelay?.delayMonths ?? null,
      change,
    };
  });

  return {
    month: prefix,
    categories,
    totals,
    inflow,
    plannedSurplus,
    achievedSurplus,
    surplusDelta: achievedSurplus - plannedSurplus,
    hasActuals: transactions.length > 0,
    goals,
    wishlist,
    previous,
    corpusChange: previous
      ? Number(input.startCorpus) - Number(previous.corpus)
      : null,
  };
}
