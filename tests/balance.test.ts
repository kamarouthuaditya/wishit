import { describe, expect, it } from 'vitest';
import { goalContributionTotal, monthlyBalance } from '@/lib/model/balance';
import { toEngineInput } from '@/lib/model/to-engine';
import { simulate } from '@/lib/engine';
import type { ExpenseItemRow, GoalRow, Snapshot } from '@/lib/db/types';

function expense(
  name: string,
  amount: number,
  type: ExpenseItemRow['type'],
  extra: Partial<ExpenseItemRow> = {},
): ExpenseItemRow {
  return {
    id: name,
    name,
    category: 'general',
    amount,
    type,
    is_budget: type === 'variable',
    frequency_months: 1,
    paid_by_card_id: null,
    effective_from: '2026-01-01',
    effective_to: null,
    is_active: true,
    ...extra,
  };
}

/** An ISO date `months` whole months from today, for deadline run-rates. */
function monthsFromNow(months: number): string {
  const now = new Date();
  const then = new Date(now.getFullYear(), now.getMonth() + months, 1);
  return `${then.getFullYear()}-${String(then.getMonth() + 1).padStart(2, '0')}-01`;
}

function goal(id: string, extra: Partial<GoalRow> = {}): GoalRow {
  return {
    id,
    name: id,
    target: 300_000,
    current_amount: 0,
    deadline: null,
    status: 'active',
    contribute_until: null,
    stop_at_deadline: false,
    priority: 1,
    expected_return_pct: 0,
    is_protected: false,
    fixed_contribution: null,
    weight: 1,
    ...extra,
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
      liquid_corpus: 100_000,
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
      expense('Rent', 25_000, 'fixed'),
      expense('Food', 8_000, 'variable'),
    ],
    loans: [],
    goals: [],
    wishlist: [],
    cards: [],
    scenarios: [],
    snapshots: [],
  };
}

describe('monthlyBalance', () => {
  it('takes expenses, savings and goal contributions off income', () => {
    const snapshot = snapshotFixture();
    snapshot.expenses.push(expense('SIP', 20_000, 'investment'));
    snapshot.goals.push(goal('emergency', { fixed_contribution: 5_000 }));

    const balance = monthlyBalance(snapshot);

    expect(balance.income).toBe(100_000);
    expect(balance.expenses).toBe(33_000);
    expect(balance.goalContributions).toBe(5_000);
    expect(balance.savings).toBe(25_000);
    expect(balance.balance).toBe(42_000);
  });

  it('charges a savings line and a goal contribution separately', () => {
    const snapshot = snapshotFixture();
    snapshot.goals.push(goal('emergency', { fixed_contribution: 5_000 }));
    snapshot.expenses.push(expense('Emergency FD', 15_000, 'investment'));

    const balance = monthlyBalance(snapshot);

    // Two commitments, two deductions: the deposit is savings, the goal takes
    // what it was told to take.
    expect(balance.goalContributions).toBe(5_000);
    expect(balance.savings).toBe(20_000);
    expect(balance.balance).toBe(47_000);
  });

  it('ignores a goal with no amount and no deadline', () => {
    const snapshot = snapshotFixture();
    snapshot.goals.push(goal('someday'));

    expect(goalContributionTotal(snapshot)).toBe(0);
    expect(monthlyBalance(snapshot).balance).toBe(67_000);
  });

  it('keeps the amount you entered even when the deadline needs more', () => {
    const snapshot = snapshotFixture();
    // 60,000 to go and ten months left needs 6,000 a month, but 1,000 is what
    // the user said they would put in. That shortfall is a warning to show, not
    // a number to overwrite.
    snapshot.goals.push(
      goal('trip', {
        target: 60_000,
        deadline: monthsFromNow(10),
        fixed_contribution: 1_000,
      }),
    );

    expect(monthlyBalance(snapshot).goalContributions).toBe(1_000);
  });

  it('falls back to the deadline run-rate when no amount is set', () => {
    const snapshot = snapshotFixture();
    snapshot.goals.push(goal('trip', { target: 60_000, deadline: monthsFromNow(10) }));

    expect(monthlyBalance(snapshot).goalContributions).toBeCloseTo(6_000, 0);
  });

  it('charges a line billed less often than monthly in full, in its own month', () => {
    // Renewing next month — the month being planned — so the whole 120,000 is
    // charged there. A twelfth of it every month would describe somebody
    // setting money aside, which is not how the bill gets paid.
    const due = snapshotFixture();
    due.expenses.push(
      expense('Annual FD', 120_000, 'investment', {
        frequency_months: 12,
        effective_from: monthsFromNow(1),
      }),
    );
    expect(monthlyBalance(due).savings).toBe(120_000);

    // The same line renewing in January is nothing to this month at all — but
    // it is running, so it is reported rather than silently dropped.
    const quiet = snapshotFixture();
    quiet.expenses.push(
      expense('Annual FD', 120_000, 'investment', { frequency_months: 12 }),
    );
    expect(monthlyBalance(quiet).savings).toBe(0);
    expect(monthlyBalance(quiet).notDueThisMonth).toBe(120_000);
  });

  it('counts a committed wishlist EMI', () => {
    const snapshot = snapshotFixture();
    snapshot.wishlist.push({
      id: 'phone',
      name: 'Phone',
      category: 'tech',
      price: 60_000,
      priority: 1,
      target_date: null,
      reason: null,
      purchase_mode: 'emi',
      emi_amount: 5_000,
      emi_tenure: 12,
      down_payment: null,
      monthly_saving: null,
      annual_rate_pct: 0,
      is_no_cost: true,
      status: 'committed',
      purchase_month: 1,
    });

    const balance = monthlyBalance(snapshot);
    expect(balance.wishlist).toBe(5_000);
    expect(balance.balance).toBe(62_000);
  });

  it('matches the projection month for month when every line is monthly', () => {
    const snapshot = snapshotFixture();
    snapshot.expenses.push(expense('SIP', 20_000, 'investment'));
    snapshot.goals.push(goal('emergency', { fixed_contribution: 5_000 }));

    const { input } = toEngineInput(snapshot);
    const firstMonth = simulate(input).months[0];

    // The header, the cashflow card and the first row of the 12-month table all
    // quote this number. They are allowed to differ only when a bill is not
    // monthly — the planning figures average those out, the projection does not.
    expect(monthlyBalance(snapshot).balance).toBeCloseTo(firstMonth.buffer, 6);
  });

  it('goes negative when commitments outrun income', () => {
    const snapshot = snapshotFixture();
    snapshot.expenses.push(expense('SIP', 80_000, 'investment'));

    expect(monthlyBalance(snapshot).balance).toBe(-13_000);
  });
});
