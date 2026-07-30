import { daysElapsed } from '@/lib/model/spending';
import { isBilledIn } from '@/lib/model/billing';
import type { ExpenseItemRow, TransactionRow } from '@/lib/db/types';
import { now as clockNow } from '@/lib/clock';

/**
 * What this month is *actually* costing, for people who do not log everything.
 *
 * The budget says what a month is supposed to cost. The log says what has left
 * so far. Neither alone answers "where will I land": logging nothing would make
 * the month look free, and logging half of it would make it look cheap.
 *
 * So every category is projected on the best evidence available for it, and the
 * page says which evidence was used. Log nothing and you get your budget back,
 * unchanged — that is the honest answer when there is nothing else to go on.
 */

export type Basis =
  /** Nothing logged here; counted at its budget. */
  | 'budget'
  /** Logged spending already exceeds the budget. */
  | 'over'
  /** Extrapolated from the rate so far. */
  | 'pace';

export interface ActualLine {
  category: string;
  type: ExpenseItemRow['type'] | 'unbudgeted';
  budget: number;
  logged: number;
  /** The part of `logged` marked one-off — never extrapolated. */
  oneOff: number;
  /** Best estimate of the whole month for this category. */
  projected: number;
  basis: Basis;
}

export interface ActualsSummary {
  lines: ActualLine[];
  /** Sum of everything logged this month. */
  logged: number;
  /** Sum of the per-category projections: where spending is heading. */
  projected: number;
  /** What the budget said the month would cost. */
  budgeted: number;
  /** projected − budgeted. Positive means heading over. */
  delta: number;
  /** Budgeted categories with at least one entry, and how many there are. */
  coverage: { logged: number; total: number };
  hasLogs: boolean;
  daysElapsed: number;
  daysInMonth: number;
}

export interface BudgetLine {
  amount: number;
  type: ExpenseItemRow['type'];
}

/**
 * Budget per category for a given `YYYY-MM`, counting only what is billed in
 * that month. A quarterly bill is its whole self in the month it renews and
 * absent from the other two, which is what you are actually spending against —
 * a third of it every month is a budget nobody keeps. A line that had not
 * started, or had already ended, does not count at all.
 */
export function budgetsByCategory(
  expenses: ExpenseItemRow[],
  month: string,
): Map<string, BudgetLine> {
  const budgets = new Map<string, BudgetLine>();
  for (const row of expenses) {
    if (!isBilledIn(row, month)) continue;

    const existing = budgets.get(row.category);
    budgets.set(row.category, {
      amount: (existing?.amount ?? 0) + Number(row.amount),
      type: existing?.type ?? row.type,
    });
  }
  return budgets;
}

function daysIn(month: string): number {
  const [year, index] = month.split('-').map(Number);
  return new Date(year, index, 0).getDate();
}

export function buildActuals(params: {
  transactions: TransactionRow[];
  /** Monthly-equivalent budget per category. */
  budgets: Map<string, BudgetLine>;
  /** `YYYY-MM`. */
  month: string;
  now?: Date;
}): ActualsSummary {
  const { transactions, budgets, month } = params;
  const now = params.now ?? clockNow();
  const inMonth = daysIn(month);
  const elapsed = Math.max(1, daysElapsed(month, now));
  const remainingShare = inMonth / elapsed;

  const logged = new Map<string, { total: number; oneOff: number }>();
  for (const tx of transactions) {
    const entry = logged.get(tx.category) ?? { total: 0, oneOff: 0 };
    logged.set(tx.category, {
      total: entry.total + Number(tx.amount),
      oneOff: entry.oneOff + (tx.is_one_off ? Number(tx.amount) : 0),
    });
  }

  const categories = [...new Set([...budgets.keys(), ...logged.keys()])];
  const lines: ActualLine[] = categories.map((category) => {
    const budget = budgets.get(category);
    const spent = logged.get(category) ?? { total: 0, oneOff: 0 };
    const routine = spent.total - spent.oneOff;

    // A one-off is by definition not the rhythm of the month, so it is added
    // once at face value rather than multiplied out to month end.
    const pace = routine * remainingShare + spent.oneOff;

    let projected: number;
    let basis: Basis;

    if (spent.total === 0) {
      // Nothing logged: the budget is the only evidence there is.
      projected = budget?.amount ?? 0;
      basis = 'budget';
    } else if (budget == null) {
      projected = pace;
      basis = 'pace';
    } else if (budget.type === 'fixed') {
      // Rent and subscriptions do not arrive at a daily rate — they are either
      // paid or about to be, so the budget stands unless the log overtakes it.
      projected = Math.max(spent.total, budget.amount);
      basis = spent.total > budget.amount ? 'over' : 'budget';
    } else {
      projected = Math.max(spent.total, pace);
      basis = projected > budget.amount ? 'over' : 'pace';
    }

    return {
      category,
      type: budget?.type ?? 'unbudgeted',
      budget: budget?.amount ?? 0,
      logged: spent.total,
      oneOff: spent.oneOff,
      projected,
      basis,
    };
  });

  lines.sort((a, b) => b.projected - a.projected);

  const budgeted = [...budgets.values()].reduce((sum, b) => sum + b.amount, 0);
  const loggedTotal = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const projected = lines.reduce((sum, line) => sum + line.projected, 0);

  const budgetedCategories = [...budgets.keys()];
  return {
    lines,
    logged: loggedTotal,
    projected,
    budgeted,
    delta: projected - budgeted,
    coverage: {
      logged: budgetedCategories.filter((c) => (logged.get(c)?.total ?? 0) > 0).length,
      total: budgetedCategories.length,
    },
    hasLogs: transactions.length > 0,
    daysElapsed: elapsed,
    daysInMonth: inMonth,
  };
}
