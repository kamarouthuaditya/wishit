import type { TransactionRow } from '@/lib/db/types';
import { now as clockNow } from '@/lib/clock';

/**
 * The daily spending log: what left your pocket, grouped the way you actually
 * remember it — by day, then by category.
 *
 * Deliberately separate from the budget model. Nothing here feeds the
 * projections; logging a ₹400 coffee is a record of the past, not a change to
 * the plan. That separation is what stops the same money being counted twice.
 */

export interface DayGroup {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  total: number;
  rows: TransactionRow[];
}

export interface CategoryTotal {
  category: string;
  total: number;
  /** Share of the month's spend, 0–1. */
  share: number;
  /** Monthly budget for this category, when there is one. */
  budget: number | null;
}

export interface MonthSummary {
  total: number;
  count: number;
  oneOff: number;
  /** Spend excluding one-offs — the part that says what a normal month costs. */
  routine: number;
  /** Mean across days elapsed, not days with spending. */
  perDay: number;
  /** Highest single day in the month. */
  busiestDay: DayGroup | null;
  days: DayGroup[];
  categories: CategoryTotal[];
}

/** `YYYY-MM` for any date. */
export function monthKey(date = clockNow()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Steps a `YYYY-MM` key by whole months, in either direction. */
export function shiftMonth(month: string, delta: number): string {
  const [year, index] = month.split('-').map(Number);
  const date = new Date(year, index - 1 + delta, 1);
  return monthKey(date);
}

/** "July 2026" */
export function monthTitle(month: string): string {
  const [year, index] = month.split('-').map(Number);
  return new Date(year, index - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * How many days of the month have happened. A month in the past counts in
 * full; the current one stops at today, so a daily average on the 3rd is not
 * divided by 31.
 */
export function daysElapsed(month: string, now = clockNow()): number {
  const [year, index] = month.split('-').map(Number);
  const inMonth = new Date(year, index, 0).getDate();
  if (monthKey(now) !== month) return inMonth;
  return Math.min(inMonth, now.getDate());
}

export function summariseMonth(
  transactions: TransactionRow[],
  options: { budgets?: Map<string, number>; now?: Date; month?: string } = {},
): MonthSummary {
  const rows = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  const total = rows.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const oneOff = rows.reduce(
    (sum, tx) => (tx.is_one_off ? sum + Number(tx.amount) : sum),
    0,
  );

  const byDay = new Map<string, TransactionRow[]>();
  for (const tx of rows) {
    const day = tx.date.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), tx]);
  }
  const days: DayGroup[] = [...byDay.entries()]
    .map(([date, dayRows]) => ({
      date,
      rows: dayRows,
      total: dayRows.reduce((sum, tx) => sum + Number(tx.amount), 0),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const byCategory = new Map<string, number>();
  for (const tx of rows) {
    byCategory.set(tx.category, (byCategory.get(tx.category) ?? 0) + Number(tx.amount));
  }
  const categories: CategoryTotal[] = [...byCategory.entries()]
    .map(([category, categoryTotal]) => ({
      category,
      total: categoryTotal,
      share: total > 0 ? categoryTotal / total : 0,
      budget: options.budgets?.get(category) ?? null,
    }))
    .sort((a, b) => b.total - a.total);

  const month = options.month ?? (rows[0]?.date.slice(0, 7) ?? monthKey(options.now));
  const elapsed = Math.max(1, daysElapsed(month, options.now ?? clockNow()));

  return {
    total,
    count: rows.length,
    oneOff,
    routine: total - oneOff,
    perDay: total / elapsed,
    busiestDay: days.reduce<DayGroup | null>(
      (worst, day) => (worst == null || day.total > worst.total ? day : worst),
      null,
    ),
    days,
    categories,
  };
}
