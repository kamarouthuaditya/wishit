import { describe, expect, it } from 'vitest';
import { planningTotals, simulate, type EngineInput } from '@/lib/engine';
import { toRecurring } from '@/lib/model/to-engine';
import type { ExpenseItemRow } from '@/lib/db/types';

/**
 * A line dated to start in September must not be deducted from July's balance.
 * The simulation always knew this; the planning figures did not, so the header
 * balance disagreed with the month-by-month projection underneath it.
 */

const ANCHOR = new Date(2026, 6, 1); // 1 July 2026

function expenseRow(extra: Partial<ExpenseItemRow> = {}): ExpenseItemRow {
  return {
    id: 'e',
    name: 'Line',
    category: 'general',
    amount: 10_000,
    type: 'fixed',
    is_budget: false,
    frequency_months: 1,
    paid_by_card_id: null,
    effective_from: '2026-01-01',
    effective_to: null,
    is_active: true,
    ...extra,
  };
}

function inputWith(fixedExpenses: EngineInput['fixedExpenses']): EngineInput {
  return {
    horizonMonths: 12,
    startCorpus: 0,
    emergencyFloor: 0,
    income: { netSalary: 1_00_000, otherIncome: [], bonusMode: 'lump' },
    fixedExpenses,
    variableExpenses: [],
    investments: [],
    loans: [],
    goals: [],
    purchases: [],
  };
}

describe('toRecurring', () => {
  it('keeps the real start date alongside the next billing month', () => {
    const past = toRecurring(
      expenseRow({ effective_from: '2024-03-01', frequency_months: 12 }),
      ANCHOR,
    );
    // Walked forward to the next anniversary, but still marked as running.
    expect(past.beginsMonth).toBeLessThan(0);
    expect(past.fromMonth).toBeGreaterThan(0);

    const future = toRecurring(
      expenseRow({ effective_from: '2026-09-01', frequency_months: 12 }),
      ANCHOR,
    );
    expect(future.beginsMonth).toBe(2);
  });

  it('treats a line starting inside this month as already running', () => {
    const line = toRecurring(expenseRow({ effective_from: '2026-07-28' }), ANCHOR);
    expect(line.beginsMonth).toBe(0);
  });
});

describe('planningTotals and effective dates', () => {
  it('excludes a line that has not started yet', () => {
    const input = inputWith([
      toRecurring(expenseRow({ id: 'rent', amount: 25_000 }), ANCHOR),
      toRecurring(
        expenseRow({ id: 'gym', amount: 3_000, effective_from: '2026-09-01' }),
        ANCHOR,
      ),
    ]);
    const plan = planningTotals(input);

    expect(plan.fixed).toBe(25_000);
    expect(plan.upcoming.fixed).toBe(3_000);
    expect(plan.upcoming.total).toBe(3_000);
    expect(plan.available).toBe(75_000);
  });

  it('excludes a line that has already ended', () => {
    const input = inputWith([
      toRecurring(
        expenseRow({ id: 'old', amount: 5_000, effective_to: '2026-05-31' }),
        ANCHOR,
      ),
    ]);
    const plan = planningTotals(input);

    expect(plan.fixed).toBe(0);
    // Finished is not the same as forthcoming — it belongs in neither figure.
    expect(plan.upcoming.total).toBe(0);
  });

  it('keeps a line that runs through the month being planned', () => {
    const input = inputWith([
      toRecurring(
        expenseRow({ id: 'ending', amount: 5_000, effective_to: '2026-08-31' }),
        ANCHOR,
      ),
    ]);
    expect(planningTotals(input).fixed).toBe(5_000);
  });

  it('drops a line that ends before the month being planned starts', () => {
    const input = inputWith([
      toRecurring(
        expenseRow({ id: 'ending', amount: 5_000, effective_to: '2026-07-31' }),
        ANCHOR,
      ),
    ]);
    // Planning looks at August; a line that stops on 31 July is not in it.
    expect(planningTotals(input).fixed).toBe(0);
  });

  it('counts a quarterly line that started long ago in its billing months', () => {
    const line = toRecurring(
      expenseRow({
        id: 'quarterly',
        amount: 9_000,
        frequency_months: 3,
        effective_from: '2025-02-01',
      }),
      ANCHOR,
    );

    // The cycle from February 2025 puts a bill in month 1 of this horizon, so
    // the whole 9,000 is charged there rather than a third of it every month.
    expect(line.fromMonth).toBe(1);
    const plan = planningTotals(inputWith([line]));
    expect(plan.fixed).toBe(9_000);
    expect(plan.notDueThisMonth).toBe(0);

    // Shift the cycle by a month and it drops out of this month entirely.
    const offCycle = { ...line, fromMonth: 2 };
    const off = planningTotals(inputWith([offCycle]));
    expect(off.fixed).toBe(0);
    expect(off.notDueThisMonth).toBe(9_000);
  });

  it('excludes an EMI that has not been drawn down yet', () => {
    const input = inputWith([]);
    input.loans = [
      {
        id: 'car',
        name: 'Car loan',
        type: 'other',
        emi: 12_000,
        startMonth: 1,
        remainingMonths: 24,
        annualRatePct: 9,
        outstanding: 2_50_000,
      },
      {
        id: 'education',
        name: 'Education loan',
        type: 'education',
        emi: 18_000,
        startMonth: 6, // drawn down in January
        remainingMonths: 60,
        annualRatePct: 10,
        outstanding: 8_00_000,
      },
    ];
    const plan = planningTotals(input);

    expect(plan.loanEmis).toBe(12_000);
    expect(plan.upcoming.loanEmis).toBe(18_000);
    expect(plan.available).toBe(88_000); // 1,00,000 − 12,000, not − 30,000

    // And the simulation agrees: nothing in month 1, both by month 6.
    const months = simulate(input).months;
    expect(months[0].loanEmis).toBe(12_000);
    expect(months[5].loanEmis).toBe(30_000);
  });

  it('agrees with what the simulation charges once the line starts', () => {
    const input = inputWith([
      toRecurring(
        expenseRow({ id: 'gym', amount: 3_000, effective_from: '2026-09-01' }),
        ANCHOR,
      ),
    ]);
    const months = simulate(input).months;

    // months[0] is month 1 — August, the month planningTotals describes.
    expect(months[0].fixed).toBe(0);
    expect(months[1].fixed).toBe(3_000); // September, when it starts
    expect(planningTotals(input).fixed).toBe(0);
  });
});
