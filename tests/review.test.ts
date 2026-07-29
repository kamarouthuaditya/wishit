import { describe, expect, it } from 'vitest';
import { buildReview } from '@/lib/model/review';
import { workedExample } from './fixtures';
import type {
  ExpenseItemRow,
  MonthlySnapshotRow,
  Snapshot,
  TransactionRow,
} from '@/lib/db/types';

const MONTH = '2026-07-01';

function expense(
  name: string,
  category: string,
  amount: number,
  type: ExpenseItemRow['type'],
): ExpenseItemRow {
  return {
    id: name,
    name,
    category,
    amount,
    type,
    is_budget: type === 'variable',
    frequency_months: 1,
    paid_by_card_id: null,
    effective_from: '2026-01-01',
    effective_to: null,
    is_active: true,
  };
}

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
    income: [],
    expenses: [
      expense('Rent', 'housing', 25_000, 'fixed'),
      expense('Food', 'food', 8_000, 'variable'),
      expense('Petrol', 'transport', 4_000, 'variable'),
    ],
    loans: [],
    goals: [],
    wishlist: [],
    cards: [],
    scenarios: [],
    snapshots: [],
  };
}

describe('budget vs actual', () => {
  it('pairs each budget line with what was actually spent', () => {
    const review = buildReview({
      snapshot: snapshotFixture(),
      input: workedExample(),
      month: MONTH,
      transactions: [
        tx('1', '2026-07-04', 9_500, 'food'),
        tx('2', '2026-07-18', 3_200, 'transport'),
        tx('3', '2026-07-02', 25_000, 'housing'),
      ],
      previous: null,
    });

    const food = review.categories.find((c) => c.category === 'food')!;
    expect(food.budget).toBe(8_000);
    expect(food.actual).toBe(9_500);
    expect(food.delta).toBe(1_500); // overspent

    const transport = review.categories.find((c) => c.category === 'transport')!;
    expect(transport.delta).toBe(-800); // under budget

    expect(review.totals.budget).toBe(37_000);
    expect(review.totals.actual).toBe(37_700);
    expect(review.totals.delta).toBe(700);
  });

  it('surfaces spend in categories that have no budget line', () => {
    const review = buildReview({
      snapshot: snapshotFixture(),
      input: workedExample(),
      month: MONTH,
      transactions: [tx('1', '2026-07-11', 6_000, 'gifts')],
      previous: null,
    });

    const gifts = review.categories.find((c) => c.category === 'gifts')!;
    expect(gifts.type).toBe('uncategorised');
    expect(gifts.budget).toBe(0);
    expect(gifts.delta).toBe(6_000);
  });

  it('separates one-offs so they are never extrapolated', () => {
    const review = buildReview({
      snapshot: snapshotFixture(),
      input: workedExample(),
      month: MONTH,
      transactions: [
        tx('1', '2026-07-09', 40_000, 'health', true),
        tx('2', '2026-07-04', 8_000, 'food'),
      ],
      previous: null,
    });

    expect(review.totals.oneOff).toBe(40_000);
    const health = review.categories.find((c) => c.category === 'health')!;
    expect(health.oneOff).toBe(40_000);
    expect(health.actual).toBe(40_000);
  });

  it('ignores expense lines that were not in effect that month', () => {
    const snapshot = snapshotFixture();
    snapshot.expenses.push({
      ...expense('Gym', 'fitness', 2_000, 'fixed'),
      effective_from: '2026-09-01',
    });

    const review = buildReview({
      snapshot,
      input: workedExample(),
      month: MONTH,
      transactions: [],
      previous: null,
    });

    expect(review.categories.find((c) => c.category === 'fitness')).toBeUndefined();
    expect(review.totals.budget).toBe(37_000);
  });
});

describe('surplus achieved vs planned', () => {
  it('measures achieved surplus against what actually left the account', () => {
    const review = buildReview({
      snapshot: snapshotFixture(),
      input: workedExample(),
      month: MONTH,
      transactions: [tx('1', '2026-07-04', 1_00_000, 'food')],
      previous: null,
      now: new Date('2026-07-31T12:00:00'),
    });

    expect(review.inflow).toBe(1_20_000);
    expect(review.plannedSurplus).toBe(23_500);
    // 1,00,000 of food actually logged, plus rent and petrol counted at their
    // budgets because nothing was logged against them. Logging one category
    // must not make the other two look free.
    expect(review.achievedSurplus).toBe(-9_000);
    expect(review.surplusDelta).toBe(-32_500);
    expect(review.hasActuals).toBe(true);
  });

  it('reports no actuals rather than a fake surplus when nothing is logged', () => {
    const review = buildReview({
      snapshot: snapshotFixture(),
      input: workedExample(),
      month: MONTH,
      transactions: [],
      previous: null,
    });
    expect(review.hasActuals).toBe(false);
  });
});

describe('corpus movement', () => {
  const previous: MonthlySnapshotRow = {
    id: 's1',
    month: '2026-06-01',
    corpus: 70_000,
    net_worth: 70_000,
    surplus: 23_500,
    savings_rate: 0.19,
    total_inflow: 1_20_000,
    total_outflow: 96_500,
  };

  it('compares against the recorded snapshot, not a recomputed past', () => {
    const review = buildReview({
      snapshot: snapshotFixture(),
      input: workedExample(),
      month: MONTH,
      transactions: [],
      previous,
    });
    expect(review.corpusChange).toBe(20_000); // 90,000 today vs 70,000 recorded
  });

  it('claims nothing when there is no earlier snapshot', () => {
    const review = buildReview({
      snapshot: snapshotFixture(),
      input: workedExample(),
      month: MONTH,
      transactions: [],
      previous: null,
    });
    expect(review.corpusChange).toBeNull();
    expect(review.wishlist.every((w) => w.change === null)).toBe(true);
  });
});

describe('wishlist movement', () => {
  const item = {
    id: 'tv',
    name: 'TV',
    category: 'tech',
    price: 60_000,
    priority: 3,
    target_date: null,
    reason: null,
    purchase_mode: 'cash' as const,
    emi_amount: null,
    emi_tenure: null,
    down_payment: null,
    monthly_saving: null,
    annual_rate_pct: 0,
    is_no_cost: false,
    status: 'planned' as const,
    purchase_month: 1,
  };

  it('flags an item that became affordable since last month', () => {
    const snapshot = snapshotFixture();
    snapshot.wishlist = [item];

    // Floor at 1,00,000. Last month's corpus of 70,000 could not absorb a
    // 60,000 cash purchase; this month's 1,90,000 can.
    const input = {
      ...workedExample(),
      startCorpus: 1_90_000,
      emergencyFloor: 1_00_000,
    };

    const review = buildReview({
      snapshot,
      input,
      month: MONTH,
      transactions: [],
      previous: {
        id: 's1',
        month: '2026-06-01',
        corpus: 70_000,
        net_worth: 70_000,
        surplus: 23_500,
        savings_rate: 0.19,
        total_inflow: 1_20_000,
        total_outflow: 96_500,
      },
    });

    expect(review.wishlist[0].affordableNow).toBe(true);
    expect(review.wishlist[0].change).toBe('became-affordable');
  });

  it('flags an item that slipped out of reach', () => {
    const snapshot = snapshotFixture();
    snapshot.wishlist = [item];

    const input = {
      ...workedExample(),
      startCorpus: 1_10_000,
      emergencyFloor: 1_00_000,
    };

    const review = buildReview({
      snapshot,
      input,
      month: MONTH,
      transactions: [],
      previous: {
        id: 's1',
        month: '2026-06-01',
        corpus: 3_00_000,
        net_worth: 3_00_000,
        surplus: 23_500,
        savings_rate: 0.19,
        total_inflow: 1_20_000,
        total_outflow: 96_500,
      },
    });

    expect(review.wishlist[0].affordableNow).toBe(false);
    expect(review.wishlist[0].change).toBe('slipped');
  });

  it('leaves committed and purchased items out of the review list', () => {
    const snapshot = snapshotFixture();
    snapshot.wishlist = [
      item,
      { ...item, id: 'done', name: 'Done', status: 'purchased' as const },
      { ...item, id: 'live', name: 'Live', status: 'committed' as const },
    ];

    const review = buildReview({
      snapshot,
      input: workedExample(),
      month: MONTH,
      transactions: [],
      previous: null,
    });

    expect(review.wishlist.map((w) => w.id)).toEqual(['tv']);
  });
});

describe('goals in the review', () => {
  it('reports on-track status and the required run-rate', () => {
    const review = buildReview({
      snapshot: snapshotFixture(),
      input: workedExample(),
      month: MONTH,
      transactions: [],
      previous: null,
    });

    const ef = review.goals[0];
    expect(ef.name).toBe('Emergency Fund');
    expect(ef.onTrack).toBe(true);
    expect(Math.round(ef.requiredMonthly)).toBe(17_500);
  });
});
