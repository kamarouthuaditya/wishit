import { simulate } from '@/lib/engine';
import { toEngineInput } from '@/lib/model/to-engine';
import { monthlyBalance } from '@/lib/model/balance';
import { buildActuals, budgetsByCategory } from '@/lib/model/actuals';
import { cardDues } from '@/lib/model/cards';
import { monthKey, monthTitle } from '@/lib/model/spending';
import { inr } from '@/lib/format';
import type { Snapshot, TransactionRow } from '@/lib/db/types';
import { now as clockNow } from '@/lib/clock';

/**
 * Things worth telling someone about, derived rather than stored.
 *
 * There is no notifications table and no background job: every item here is a
 * fact about the data as it stands right now, computed on the request that
 * renders the bell. A card bill either is due in four days or it is not.
 *
 * That also means a notification cannot go stale or lie — pay the bill and it
 * disappears, because the condition that produced it is gone.
 */

export type NoticeTone = 'bad' | 'warn' | 'info';

export interface Notice {
  /** Stable across renders so dismissals can be remembered per item. */
  id: string;
  tone: NoticeTone;
  title: string;
  detail: string;
  href: string;
}

export function buildNotices(
  snapshot: Snapshot,
  transactions: TransactionRow[],
  now = clockNow(),
): Notice[] {
  const notices: Notice[] = [];
  const month = monthKey(now);

  // ---- card bills, soonest first ----------------------------------------
  for (const due of cardDues(snapshot.cards, transactions, snapshot.expenses, now)) {
    if (due.closed.total <= 0) continue;

    if (due.daysToDue < 0) {
      notices.push({
        id: `card-late-${due.card.id}-${month}`,
        tone: 'bad',
        title: `${due.card.name} is overdue`,
        detail: `${inr(due.closed.total)} was due ${Math.abs(due.daysToDue)} days ago.`,
        href: '/cards',
      });
    } else if (due.daysToDue <= 7) {
      notices.push({
        id: `card-due-${due.card.id}-${month}`,
        tone: 'warn',
        title: `${due.card.name} bill due in ${due.daysToDue} days`,
        detail: `${inr(due.closed.total)} statemented. Another ${inr(due.open.total)} is already accruing for next month.`,
        href: '/cards',
      });
    }
  }

  // ---- EMIs about to leave ----------------------------------------------
  for (const loan of snapshot.loans) {
    if (Number(loan.emi) <= 0) continue;
    if (new Date(loan.start_date) > now) continue;

    const days = daysUntilDay(loan.due_day, now);
    if (days <= 5) {
      notices.push({
        id: `emi-${loan.id}-${month}`,
        tone: 'info',
        title: `${loan.name} EMI in ${days} days`,
        detail: `${inr(Number(loan.emi))} leaves on the ${loan.due_day}th.`,
        href: '/loans',
      });
    }
  }

  // ---- the month heading over budget ------------------------------------
  const actuals = buildActuals({
    transactions,
    budgets: budgetsByCategory(snapshot.expenses, month),
    month,
    now,
  });
  if (actuals.hasLogs && actuals.delta > 0) {
    const worst = actuals.lines
      .filter((line) => line.basis === 'over')
      .sort((a, b) => b.projected - b.budget - (a.projected - a.budget))[0];

    notices.push({
      id: `over-${month}`,
      tone: 'warn',
      title: `${monthTitle(month)} is heading over budget`,
      detail: worst
        ? `${inr(actuals.delta)} over, mostly ${worst.category} at ${inr(worst.projected)} against ${inr(worst.budget)}.`
        : `${inr(actuals.delta)} over what you budgeted.`,
      href: '/spending',
    });
  }

  // ---- structural problems ----------------------------------------------
  const balance = monthlyBalance(snapshot);
  if (balance.balance < 0) {
    notices.push({
      id: `negative-balance-${month}`,
      tone: 'bad',
      title: 'You are committed past your income',
      detail: `${inr(Math.abs(balance.balance))} more goes out each month than comes in.`,
      href: '/expenses',
    });
  }

  const { input } = toEngineInput(snapshot, now);
  const result = simulate(input);
  const behind = result.goals.filter((goal) => goal.missedDeadline);
  if (behind.length > 0) {
    notices.push({
      id: `goals-behind-${behind.map((g) => g.goalId).join('-')}`,
      tone: 'warn',
      title:
        behind.length === 1
          ? `${behind[0].name} will miss its target date`
          : `${behind.length} goals will miss their target dates`,
      detail:
        behind.length === 1
          ? 'At the current contribution it lands late.'
          : behind.map((g) => g.name).join(', ') + '.',
      href: '/goals',
    });
  }

  // ---- the review, once the month is nearly done ------------------------
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (daysInMonth - now.getDate() <= 3) {
    notices.push({
      id: `review-${month}`,
      tone: 'info',
      title: `${monthTitle(month)} is nearly over`,
      detail: 'Check the budget against what actually happened.',
      href: '/review',
    });
  }

  const order: Record<NoticeTone, number> = { bad: 0, warn: 1, info: 2 };
  return notices.sort((a, b) => order[a.tone] - order[b.tone]);
}

/** Days until the `day`th of the month, wrapping into next month. */
function daysUntilDay(day: number, now: Date): number {
  const current = now.getDate();
  if (day >= current) return day - current;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return daysInMonth - current + day;
}
