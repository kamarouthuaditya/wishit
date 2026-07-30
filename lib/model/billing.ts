import type { ExpenseItemRow } from '@/lib/db/types';

/**
 * Which calendar months a recurring line is actually billed in.
 *
 * The engine answers this in month offsets, because that is what the simulation
 * walks in. Two places ask it in `YYYY-MM` instead — the category budgets on the
 * spending page and the recurring charges on a card — and they used to answer it
 * by dividing: a half-yearly bill counted as a sixth of itself every month.
 *
 * Nothing is paid that way. The bill arrives whole in the month it renews, so
 * that is the month it is charged, and the other five are free of it. This is
 * the same rule as `isDue` in the engine, phrased for rows and month keys.
 */

/** Whole months from one `YYYY-MM` to another. Negative when `month` is earlier. */
export function monthsBetween(from: string, month: string): number {
  const [fromYear, fromIndex] = from.slice(0, 7).split('-').map(Number);
  const [year, index] = month.slice(0, 7).split('-').map(Number);
  return (year - fromYear) * 12 + (index - fromIndex);
}

/** True when this row is in force in `month` — billed or not. */
export function isRunningIn(
  row: Pick<ExpenseItemRow, 'effective_from' | 'effective_to'>,
  month: string,
): boolean {
  if (row.effective_from.slice(0, 7) > month) return false;
  if (row.effective_to && row.effective_to.slice(0, 7) < month) return false;
  return true;
}

/**
 * True when the row's bill actually lands in `month`.
 *
 * The cycle is counted from `effective_from`, so a gym that started in March and
 * renews every six months is billed in March and September however long ago that
 * was — not in whichever month you happen to be looking at it.
 */
export function isBilledIn(
  row: Pick<
    ExpenseItemRow,
    'effective_from' | 'effective_to' | 'frequency_months'
  >,
  month: string,
): boolean {
  if (!isRunningIn(row, month)) return false;
  const every = Math.max(1, Math.round(Number(row.frequency_months ?? 1)));
  if (every === 1) return true;
  return monthsBetween(row.effective_from, month) % every === 0;
}

/** `2026-07` + 5 → `2026-12`. */
function addMonths(month: string, count: number): string {
  const [year, index] = month.slice(0, 7).split('-').map(Number);
  const shifted = new Date(year, index - 1 + count, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * The next month this row is billed, at or after `month`. Null once the line
 * has ended — there is no next bill to name.
 *
 * The rows carry the full amount now rather than a monthly share of it, so the
 * question "when does that leave?" has to be answerable on the row itself.
 */
export function nextBilledMonth(
  row: Pick<
    ExpenseItemRow,
    'effective_from' | 'effective_to' | 'frequency_months'
  >,
  month: string,
): string | null {
  const every = Math.max(1, Math.round(Number(row.frequency_months ?? 1)));
  const elapsed = monthsBetween(row.effective_from, month);
  // Before it starts the answer is its own first month; after, the next tick of
  // the cycle at or after now.
  const ahead = elapsed <= 0 ? 0 : Math.ceil(elapsed / every) * every;
  const next = addMonths(row.effective_from, ahead);
  if (row.effective_to && next > row.effective_to.slice(0, 7)) return null;
  return next;
}
