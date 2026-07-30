import type {
  CreditCardRow,
  ExpenseItemRow,
  TransactionRow,
} from '@/lib/db/types';
import { now as clockNow } from '@/lib/clock';
import { isBilledIn } from '@/lib/model/billing';

/**
 * What a card actually owes, from what you recorded.
 *
 * A card bill is a due, like an EMI: money already spent that leaves your
 * account on a date you did not pick. It is emphatically *not* an extra
 * expense — a ₹2,000 dinner on a card is the same ₹2,000 whether it leaves on
 * Tuesday or on the 5th of next month. So nothing here is added to the budget
 * again. What the card changes is *when*, and that is all this models.
 *
 * Two cycles matter:
 *
 *   - **Closed**: spending up to the last statement day. That is the bill with a
 *     due date, and it is the number you have to pay.
 *   - **Open**: spending since then. It is still accruing, and it becomes next
 *     month's bill.
 */

export interface CardCycle {
  /** Inclusive start of the window. */
  from: Date;
  /** Exclusive end: the statement day. */
  to: Date;
  /** When the bill for this window has to be paid. */
  due: Date;
  total: number;
  count: number;
}

export interface CardDue {
  card: CreditCardRow;
  /** Statemented and payable. */
  closed: CardCycle;
  /** Still accruing; becomes next month's bill. */
  open: CardCycle;
  /** Recurring budget lines this card is billed for this month, in full. */
  recurringMonthly: number;
  /** closed.total as a share of the limit, 0 when there is no limit. */
  utilisation: number;
  /** Days until the closed bill is due. Negative once it is late. */
  daysToDue: number;
  /** Nothing recorded against this card at all. */
  unused: boolean;
}

/** The `day`th of a month, clamped for short months (31 → 30 in April). */
function dayIn(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

function sumBetween(
  transactions: TransactionRow[],
  cardId: string,
  from: Date,
  to: Date,
): { total: number; count: number } {
  let total = 0;
  let count = 0;
  for (const tx of transactions) {
    if (tx.paid_by_card_id !== cardId) continue;
    const when = new Date(`${tx.date.slice(0, 10)}T00:00:00`);
    if (when >= from && when < to) {
      total += Number(tx.amount);
      count += 1;
    }
  }
  return { total, count };
}

export function cardDue(
  card: CreditCardRow,
  transactions: TransactionRow[],
  expenses: ExpenseItemRow[],
  now = clockNow(),
): CardDue {
  const statementDay = Math.max(1, Math.min(31, card.statement_day ?? 1));
  const dueDay = Math.max(1, Math.min(31, card.due_day ?? 20));

  // The most recent statement that has already been cut.
  const thisMonthStatement = dayIn(now.getFullYear(), now.getMonth(), statementDay);
  const lastStatement =
    now >= thisMonthStatement
      ? thisMonthStatement
      : dayIn(now.getFullYear(), now.getMonth() - 1, statementDay);

  const previousStatement = dayIn(
    lastStatement.getFullYear(),
    lastStatement.getMonth() - 1,
    statementDay,
  );
  const nextStatement = dayIn(
    lastStatement.getFullYear(),
    lastStatement.getMonth() + 1,
    statementDay,
  );

  // The due date follows its statement. A due day earlier in the month than the
  // statement day means it falls the month after.
  const dueFor = (statement: Date) =>
    dueDay > statement.getDate()
      ? dayIn(statement.getFullYear(), statement.getMonth(), dueDay)
      : dayIn(statement.getFullYear(), statement.getMonth() + 1, dueDay);

  const closedSpend = sumBetween(transactions, card.id, previousStatement, lastStatement);
  const openSpend = sumBetween(transactions, card.id, lastStatement, nextStatement);

  // What the card is charged this month, not a smoothed share of it: an annual
  // insurance premium on this card is the whole premium in its renewal month
  // and nothing in the other eleven, which is the bill you have to find.
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const recurringMonthly = expenses
    .filter(
      (e) =>
        e.paid_by_card_id === card.id && e.is_active && isBilledIn(e, thisMonth),
    )
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const closedDue = dueFor(lastStatement);
  const limit = Number(card.credit_limit) || 0;

  return {
    card,
    closed: {
      from: previousStatement,
      to: lastStatement,
      due: closedDue,
      total: closedSpend.total,
      count: closedSpend.count,
    },
    open: {
      from: lastStatement,
      to: nextStatement,
      due: dueFor(nextStatement),
      total: openSpend.total,
      count: openSpend.count,
    },
    recurringMonthly,
    utilisation: limit > 0 ? closedSpend.total / limit : 0,
    daysToDue: Math.round(
      (closedDue.getTime() - startOfDay(now).getTime()) / 86_400_000,
    ),
    unused:
      closedSpend.count === 0 && openSpend.count === 0 && recurringMonthly === 0,
  };
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Every card, worst first: what is due soonest and largest leads. */
export function cardDues(
  cards: CreditCardRow[],
  transactions: TransactionRow[],
  expenses: ExpenseItemRow[],
  now = clockNow(),
): CardDue[] {
  return cards
    .map((card) => cardDue(card, transactions, expenses, now))
    .sort((a, b) => a.daysToDue - b.daysToDue || b.closed.total - a.closed.total);
}
