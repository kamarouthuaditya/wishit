import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MonthlySnapshotRow, Snapshot } from '@/lib/db/types';

// The module is server-only and talks to a driver; both are stubbed so the
// insert/update decision can be tested on its own.
vi.mock('server-only', () => ({}));

const insert = vi.fn();
const update = vi.fn();
vi.mock('@/lib/db/driver', () => ({
  driver: () => ({ insert, update }),
}));

const { ensureMonthlySnapshot, monthKeyOf } = await import('@/lib/snapshot');

const NOW = new Date('2026-07-15T00:00:00Z');

function snapshotFixture(): Snapshot {
  return {
    profile: {
      id: 'p',
      name: 'Me',
      currency: 'INR',
      fiscal_month_start: 1,
      pay_date: 1,
      liquid_corpus: 90_000,
      emergency_floor: 0,
      annual_return_pct: 0,
      annual_inflation_pct: 0,
      bonus_mode: 'lump',
      allocation_mode: 'waterfall',
      horizon_months: 36,
      setup_complete: true,
      onboarding_step: 6,
    },
    income: [
      {
        id: 'salary',
        type: 'salary',
        label: 'Net salary',
        amount: 100_000,
        frequency: 'monthly',
        bonus_month: null,
        effective_from: '2026-01-01',
        effective_to: null,
      },
    ],
    expenses: [
      {
        id: 'rent',
        name: 'Rent',
        category: 'housing',
        amount: 25_000,
        type: 'fixed',
        is_budget: false,
        frequency_months: 1,
        paid_by_card_id: null,
        effective_from: '2026-01-01',
        effective_to: null,
        is_active: true,
      },
    ],
    loans: [],
    goals: [],
    wishlist: [],
    cards: [],
    scenarios: [],
    snapshots: [],
  };
}

function existingRow(patch: Partial<MonthlySnapshotRow> = {}): MonthlySnapshotRow {
  return {
    id: 'row-1',
    month: monthKeyOf(NOW),
    corpus: 90_000,
    net_worth: 90_000,
    surplus: 75_000,
    savings_rate: 0.75,
    total_inflow: 100_000,
    total_outflow: 25_000,
    created_at: '2026-07-01T00:00:00Z',
    ...patch,
  } as MonthlySnapshotRow;
}

describe('ensureMonthlySnapshot', () => {
  beforeEach(() => {
    insert.mockReset().mockImplementation(async (_t, row) => ({ id: 'new', ...row }));
    update.mockReset().mockImplementation(async (_t, id, patch) => ({ id, ...patch }));
  });

  it('writes the row the first time the month is seen', async () => {
    const result = await ensureMonthlySnapshot(snapshotFixture(), NOW);

    expect(insert).toHaveBeenCalledTimes(1);
    expect(result.written).toBe(true);
    expect(result.month).toBe('2026-07-01');
  });

  it('refreshes the month in progress once the figures move', async () => {
    const snapshot = snapshotFixture();
    snapshot.snapshots.push(existingRow());
    // Entered after the row was first written.
    snapshot.expenses.push({
      ...snapshot.expenses[0],
      id: 'sip',
      name: 'SIP',
      category: 'investment',
      amount: 20_000,
      type: 'investment',
    });

    const result = await ensureMonthlySnapshot(snapshot, NOW);

    expect(insert).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(result.written).toBe(true);
    expect(result.row?.surplus).toBe(55_000);
    expect(result.row?.total_outflow).toBe(45_000);
  });

  it('writes nothing when the stored figures still match', async () => {
    const snapshot = snapshotFixture();
    snapshot.snapshots.push(existingRow());

    const result = await ensureMonthlySnapshot(snapshot, NOW);

    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(result.written).toBe(false);
    expect(result.row?.id).toBe('row-1');
  });

  it('leaves earlier months alone', async () => {
    const snapshot = snapshotFixture();
    snapshot.snapshots.push(existingRow({ id: 'june', month: '2026-06-01', surplus: 1 }));

    await ensureMonthlySnapshot(snapshot, NOW);

    expect(update).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledTimes(1); // July, not June
  });
});
