import { describe, expect, it } from 'vitest';
import {
  daysElapsed,
  monthKey,
  monthTitle,
  shiftMonth,
  summariseMonth,
} from '@/lib/model/spending';
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

const JULY = [
  tx('1', '2026-07-04', 1_200, 'food'),
  tx('2', '2026-07-04', 800, 'food'),
  tx('3', '2026-07-09', 40_000, 'health', true),
  tx('4', '2026-07-11', 2_000, 'transport'),
];

describe('month keys', () => {
  it('steps forwards and backwards across year ends', () => {
    expect(shiftMonth('2026-07', -1)).toBe('2026-06');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('names a month for a human', () => {
    expect(monthTitle('2026-07')).toContain('2026');
    expect(monthTitle('2026-07')).toContain('July');
  });

  it('counts a past month in full and the current one only so far', () => {
    const now = new Date('2026-07-11T12:00:00');
    expect(daysElapsed('2026-06', now)).toBe(30);
    expect(daysElapsed('2026-07', now)).toBe(11);
    expect(monthKey(now)).toBe('2026-07');
  });
});

describe('summariseMonth', () => {
  const now = new Date('2026-07-11T12:00:00');
  const summary = () => summariseMonth(JULY, { now, month: '2026-07' });

  it('totals the month and counts the entries', () => {
    expect(summary().total).toBe(44_000);
    expect(summary().count).toBe(4);
  });

  it('separates one-offs from ordinary spending', () => {
    expect(summary().oneOff).toBe(40_000);
    expect(summary().routine).toBe(4_000);
  });

  it('groups by day, newest first, with a per-day total', () => {
    const days = summary().days;
    expect(days.map((d) => d.date)).toEqual([
      '2026-07-11',
      '2026-07-09',
      '2026-07-04',
    ]);
    expect(days.at(-1)!.total).toBe(2_000); // the two food rows on the 4th
    expect(days.at(-1)!.rows).toHaveLength(2);
  });

  it('finds the biggest day', () => {
    expect(summary().busiestDay?.date).toBe('2026-07-09');
    expect(summary().busiestDay?.total).toBe(40_000);
  });

  it('averages over days elapsed, not days with spending', () => {
    // 44,000 over the 11 days so far, not over the 3 days that had entries.
    expect(summary().perDay).toBeCloseTo(4_000, 0);
  });

  it('ranks categories by size and works out each share', () => {
    const categories = summary().categories;
    expect(categories.map((c) => c.category)).toEqual([
      'health',
      'transport',
      'food',
    ]);
    expect(categories[0].share).toBeCloseTo(40_000 / 44_000, 4);
  });

  it('attaches a budget where the category has one', () => {
    const budgets = new Map([['food', 8_000]]);
    const categories = summariseMonth(JULY, { budgets, now, month: '2026-07' })
      .categories;

    expect(categories.find((c) => c.category === 'food')!.budget).toBe(8_000);
    expect(categories.find((c) => c.category === 'health')!.budget).toBeNull();
  });

  it('handles an empty month without dividing by zero', () => {
    const empty = summariseMonth([], { now, month: '2026-07' });

    expect(empty.total).toBe(0);
    expect(empty.perDay).toBe(0);
    expect(empty.busiestDay).toBeNull();
    expect(empty.days).toEqual([]);
    expect(empty.categories).toEqual([]);
  });
});
