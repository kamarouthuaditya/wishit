import type { GoalRow } from '@/lib/db/types';
import { now as clockNow } from '@/lib/clock';

/** Months from today until the goal's target date, or null if it has none. */
export function deadlineMonths(goal: GoalRow, now = clockNow()): number | null {
  if (!goal.deadline) return null;
  const target = new Date(goal.deadline);
  const months =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  return Math.max(0, months);
}
