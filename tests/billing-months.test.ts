import { describe, expect, it } from 'vitest';
import {
  isBilledIn,
  isRunningIn,
  monthsBetween,
  nextBilledMonth,
} from '@/lib/model/billing';
import type { ExpenseItemRow } from '@/lib/db/types';

function row(extra: Partial<ExpenseItemRow> = {}): ExpenseItemRow {
  return {
    id: 'gym',
    name: 'Gym',
    category: 'fitness',
    amount: 9_000,
    type: 'fixed',
    is_budget: false,
    frequency_months: 6,
    paid_by_card_id: null,
    effective_from: '2026-03-15',
    effective_to: null,
    is_active: true,
    ...extra,
  };
}

describe('monthsBetween', () => {
  it('counts whole months across a year boundary, signed', () => {
    expect(monthsBetween('2026-03', '2026-09')).toBe(6);
    expect(monthsBetween('2025-11', '2026-02')).toBe(3);
    expect(monthsBetween('2026-09', '2026-03')).toBe(-6);
    expect(monthsBetween('2026-03-15', '2026-03')).toBe(0);
  });
});

describe('isBilledIn', () => {
  it('charges a half-yearly line only in its renewal months', () => {
    const gym = row();
    expect(isBilledIn(gym, '2026-03')).toBe(true);
    expect(isBilledIn(gym, '2026-09')).toBe(true);
    expect(isBilledIn(gym, '2027-03')).toBe(true);

    for (const quiet of ['2026-04', '2026-05', '2026-07', '2026-08']) {
      expect(isBilledIn(gym, quiet)).toBe(false);
    }
  });

  it('keeps the rhythm of the start date, not the month being asked about', () => {
    // Started in February, so the cycle is Feb / Aug — never March.
    const feb = row({ effective_from: '2026-02-01' });
    expect(isBilledIn(feb, '2026-02')).toBe(true);
    expect(isBilledIn(feb, '2026-03')).toBe(false);
    expect(isBilledIn(feb, '2026-08')).toBe(true);
  });

  it('bills a monthly line every month it is running', () => {
    const rent = row({ frequency_months: 1, effective_from: '2026-03-01' });
    expect(isBilledIn(rent, '2026-03')).toBe(true);
    expect(isBilledIn(rent, '2026-04')).toBe(true);
    expect(isBilledIn(rent, '2026-02')).toBe(false); // before it starts
  });

  it('stops at the end date, on a renewal month or otherwise', () => {
    const ending = row({ effective_to: '2026-08-31' });
    expect(isBilledIn(ending, '2026-03')).toBe(true);
    expect(isBilledIn(ending, '2026-09')).toBe(false); // due, but it has ended
    expect(isRunningIn(ending, '2026-07')).toBe(true);
    expect(isRunningIn(ending, '2026-09')).toBe(false);
  });
});

describe('nextBilledMonth', () => {
  it('names the next renewal from where you are standing', () => {
    const gym = row();
    expect(nextBilledMonth(gym, '2026-03')).toBe('2026-03'); // due now
    expect(nextBilledMonth(gym, '2026-04')).toBe('2026-09');
    expect(nextBilledMonth(gym, '2026-09')).toBe('2026-09');
    expect(nextBilledMonth(gym, '2026-10')).toBe('2027-03');
  });

  it('answers with its own first month before it has started', () => {
    expect(nextBilledMonth(row(), '2025-12')).toBe('2026-03');
  });

  it('has no next bill once the line has ended', () => {
    expect(nextBilledMonth(row({ effective_to: '2026-08-31' }), '2026-04')).toBe(
      null,
    );
  });
});
