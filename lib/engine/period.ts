/**
 * Date <-> month-offset mapping. The engine itself never sees a Date; this is
 * the only place calendar maths happens.
 *
 * Month 1 is the first full month after `anchor`. An event dated inside the
 * anchor month maps to month 0 (already happened / happening now).
 */

export function monthKey(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

/** Month offset of `date` relative to `anchor`. Can be negative. */
export function toMonthOffset(date: Date | string, anchor: Date): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  return monthKey(d) - monthKey(anchor);
}

/** Inverse of `toMonthOffset` - the 1st of the resulting month. */
export function fromMonthOffset(offset: number, anchor: Date): Date {
  return new Date(anchor.getFullYear(), anchor.getMonth() + offset, 1);
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** "Oct 2026" for a month offset. Fractional offsets round to the nearest month. */
export function labelForMonth(offset: number, anchor: Date): string {
  const d = fromMonthOffset(Math.round(offset), anchor);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Months between two dates, floored at 0. Useful for goal deadlines. */
export function monthsUntil(target: Date | string, anchor: Date): number {
  return Math.max(0, toMonthOffset(target, anchor));
}

/** First day of the current month - the standard simulation anchor. */
export function monthAnchor(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
