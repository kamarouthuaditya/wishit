import { describe, expect, it } from 'vitest';
import { cardDue } from '@/lib/model/cards';
import type {
  CreditCardRow,
  ExpenseItemRow,
  TransactionRow,
} from '@/lib/db/types';

const CARD: CreditCardRow = {
  id: 'hdfc',
  name: 'HDFC',
  credit_limit: 200_000,
  statement_day: 18,
  due_day: 5,
  current_bill: 0,
};

function tx(
  id: string,
  date: string,
  amount: number,
  card: string | null = 'hdfc',
): TransactionRow {
  return {
    id,
    date,
    amount,
    category: 'general',
    note: null,
    source: 'manual',
    is_one_off: false,
    paid_by_card_id: card,
  };
}

function expense(amount: number, card: string | null, every = 1): ExpenseItemRow {
  return {
    id: `e${amount}`,
    name: 'Line',
    category: 'utilities',
    amount,
    type: 'fixed',
    is_budget: false,
    frequency_months: every,
    paid_by_card_id: card,
    effective_from: '2026-01-01',
    effective_to: null,
    is_active: true,
  };
}

// 29 July: the 18 July statement is cut, the next is 18 August.
const NOW = new Date(2026, 6, 29);

describe('cardDue', () => {
  it('bills the closed cycle and leaves the open one accruing', () => {
    const due = cardDue(
      CARD,
      [
        tx('a', '2026-06-20', 4_000), // after 18 Jun, before 18 Jul → closed
        tx('b', '2026-07-02', 6_000), // closed
        tx('c', '2026-07-20', 2_500), // after 18 Jul → open
      ],
      [],
      NOW,
    );

    expect(due.closed.total).toBe(10_000);
    expect(due.closed.count).toBe(2);
    expect(due.open.total).toBe(2_500);
  });

  it('dates the bill to the due day after its statement', () => {
    const due = cardDue(CARD, [], [], NOW);

    // Statement 18 July, due day the 5th → 5 August.
    expect(due.closed.due.getFullYear()).toBe(2026);
    expect(due.closed.due.getMonth()).toBe(7);
    expect(due.closed.due.getDate()).toBe(5);
    expect(due.daysToDue).toBe(7);
  });

  it('keeps the due date inside the same month when the day allows', () => {
    const due = cardDue({ ...CARD, statement_day: 2, due_day: 22 }, [], [], NOW);

    // Statement 2 July, due the 22nd → 22 July, same month.
    expect(due.closed.due.getMonth()).toBe(6);
    expect(due.closed.due.getDate()).toBe(22);
  });

  it('ignores spending on other cards and on the bank account', () => {
    const due = cardDue(
      CARD,
      [tx('a', '2026-07-02', 5_000, 'other'), tx('b', '2026-07-03', 900, null)],
      [],
      NOW,
    );

    expect(due.closed.total).toBe(0);
    expect(due.open.total).toBe(0);
  });

  it('reports what the card is billed this month, in full', () => {
    const due = cardDue(
      CARD,
      [],
      [expense(1_200, 'hdfc'), expense(12_000, 'hdfc', 12), expense(9_000, null)],
      NOW,
    );

    // The monthly line only. The annual one renews in its own month, and this
    // is not it — smoothing it to 1,000 would describe a bill nobody receives.
    expect(due.recurringMonthly).toBe(1_200);
  });

  it('works out utilisation against the limit', () => {
    const due = cardDue(CARD, [tx('a', '2026-07-01', 50_000)], [], NOW);
    expect(due.utilisation).toBeCloseTo(0.25, 4);
  });

  it('says when a card has nothing recorded against it', () => {
    expect(cardDue(CARD, [], [], NOW).unused).toBe(true);
    expect(cardDue(CARD, [tx('a', '2026-07-02', 100)], [], NOW).unused).toBe(false);
  });

  it('clamps a statement day past the end of a short month', () => {
    const feb = new Date(2026, 1, 20);
    const due = cardDue({ ...CARD, statement_day: 31 }, [], [], feb);

    // February has 28 days in 2026, so the cycle ends on the 28th.
    expect(due.closed.to.getMonth()).toBe(0); // last cut statement: 31 January
    expect(due.open.to.getDate()).toBe(28);
  });

  it('goes negative on days-to-due once the bill is late', () => {
    const late = new Date(2026, 7, 9); // 9 August, bill was due the 5th
    expect(cardDue(CARD, [], [], late).daysToDue).toBeLessThan(0);
  });
});
