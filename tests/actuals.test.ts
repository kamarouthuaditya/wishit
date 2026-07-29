import { describe, expect, it } from 'vitest';
import { buildActuals, type BudgetLine } from '@/lib/model/actuals';
import type { TransactionRow } from '@/lib/db/types';

function tx(
  id: string,
  date: string,
  amount: number,
  category: string,
  oneOff = false,
): TransactionRow {
  return {
    id,
    date,
    amount,
    category,
    note: null,
    source: 'manual',
    is_one_off: oneOff,
    paid_by_card_id: null,
  };
}

const BUDGETS = new Map<string, BudgetLine>([
  ['housing', { amount: 25_000, type: 'fixed' }],
  ['food', { amount: 8_000, type: 'variable' }],
  ['transport', { amount: 4_000, type: 'variable' }],
]);

// Half way through a 30-day month.
const MID = new Date('2026-06-15T12:00:00');
const build = (transactions: TransactionRow[], now = MID) =>
  buildActuals({ transactions, budgets: BUDGETS, month: '2026-06', now });

describe('buildActuals — someone who logs nothing', () => {
  it('falls back to the budget, unchanged', () => {
    const summary = build([]);

    expect(summary.hasLogs).toBe(false);
    expect(summary.logged).toBe(0);
    expect(summary.projected).toBe(37_000);
    expect(summary.budgeted).toBe(37_000);
    expect(summary.delta).toBe(0);
    expect(summary.lines.every((l) => l.basis === 'budget')).toBe(true);
  });

  it('reports zero coverage so the page can say why', () => {
    expect(build([]).coverage).toEqual({ logged: 0, total: 3 });
  });
});

describe('buildActuals — someone who logs some of it', () => {
  it('projects logged categories at their pace and the rest at budget', () => {
    // 3,000 of food over 15 days → 6,000 by month end. Nothing else logged.
    const summary = build([
      tx('1', '2026-06-03', 1_000, 'food'),
      tx('2', '2026-06-12', 2_000, 'food'),
    ]);

    const food = summary.lines.find((l) => l.category === 'food')!;
    expect(food.logged).toBe(3_000);
    expect(food.projected).toBe(6_000);
    expect(food.basis).toBe('pace');

    const transport = summary.lines.find((l) => l.category === 'transport')!;
    expect(transport.projected).toBe(4_000);
    expect(transport.basis).toBe('budget');

    // 25,000 rent + 6,000 food pace + 4,000 transport budget
    expect(summary.projected).toBe(35_000);
    expect(summary.delta).toBe(-2_000);
    expect(summary.coverage).toEqual({ logged: 1, total: 3 });
  });

  it('flags a category heading over its budget', () => {
    // 6,000 in 15 days → 12,000 projected against an 8,000 budget.
    const summary = build([tx('1', '2026-06-10', 6_000, 'food')]);
    const food = summary.lines.find((l) => l.category === 'food')!;

    expect(food.projected).toBe(12_000);
    expect(food.basis).toBe('over');
    expect(summary.delta).toBe(4_000);
  });

  it('never extrapolates a one-off', () => {
    const summary = build([tx('1', '2026-06-05', 40_000, 'health', true)]);
    const health = summary.lines.find((l) => l.category === 'health')!;

    expect(health.type).toBe('unbudgeted');
    expect(health.oneOff).toBe(40_000);
    expect(health.projected).toBe(40_000); // not 80,000
  });

  it('extrapolates the routine part of a category but not its one-off', () => {
    const summary = build([
      tx('1', '2026-06-05', 40_000, 'food', true),
      tx('2', '2026-06-06', 2_000, 'food'),
    ]);
    const food = summary.lines.find((l) => l.category === 'food')!;

    // 2,000 doubles to 4,000; the 40,000 is added once.
    expect(food.projected).toBe(44_000);
  });
});

describe('buildActuals — fixed lines', () => {
  it('keeps a fixed line at its budget when part of it is logged', () => {
    const summary = build([tx('1', '2026-06-02', 25_000, 'housing')]);
    const housing = summary.lines.find((l) => l.category === 'housing')!;

    // Rent is not a daily rate: paying it on the 2nd does not mean 50,000.
    expect(housing.projected).toBe(25_000);
    expect(housing.basis).toBe('budget');
  });

  it('follows the log when a fixed line is overspent', () => {
    const summary = build([tx('1', '2026-06-02', 27_000, 'housing')]);
    const housing = summary.lines.find((l) => l.category === 'housing')!;

    expect(housing.projected).toBe(27_000);
    expect(housing.basis).toBe('over');
  });
});

describe('buildActuals — timing', () => {
  it('does not extrapolate wildly on the first day', () => {
    const summary = build([tx('1', '2026-06-01', 500, 'food')], new Date('2026-06-01T09:00:00'));
    const food = summary.lines.find((l) => l.category === 'food')!;

    // One day in, 500 a day reads as 15,000 — high, but it is what the only
    // evidence says, and the basis tells the page to label it a pace.
    expect(food.projected).toBe(15_000);
    expect(food.basis).toBe('over');
    expect(summary.daysElapsed).toBe(1);
    expect(summary.daysInMonth).toBe(30);
  });

  it('stops extrapolating once the month is over', () => {
    const summary = build(
      [tx('1', '2026-06-10', 6_000, 'food')],
      new Date('2026-08-01T09:00:00'),
    );
    const food = summary.lines.find((l) => l.category === 'food')!;

    expect(summary.daysElapsed).toBe(30);
    expect(food.projected).toBe(6_000); // the month is closed; this is the fact
  });
});
