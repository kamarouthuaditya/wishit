import { describe, expect, it } from 'vitest';
import { planningTotals, simulate, type EngineInput, type GoalConfig } from '@/lib/engine';
import { toGoalConfig } from '@/lib/model/to-engine';
import type { GoalRow } from '@/lib/db/types';

/**
 * A goal ends in one of three ways: it fills up, you mark it done, or you stop
 * paying in on a date. In every case the balance stays put — what changes is
 * that it stops taking money, and the surplus goes back to being yours.
 */

function goal(extra: Partial<GoalConfig> = {}): GoalConfig {
  return {
    id: 'car',
    name: 'Car fund',
    target: 5_00_000,
    current: 0,
    priority: 1,
    fixedContribution: 10_000,
    ...extra,
  };
}

function inputWith(goals: GoalConfig[]): EngineInput {
  return {
    horizonMonths: 12,
    startCorpus: 0,
    emergencyFloor: 0,
    income: { netSalary: 50_000, otherIncome: [], bonusMode: 'lump' },
    fixedExpenses: [{ id: 'rent', name: 'Rent', amount: 20_000 }],
    variableExpenses: [],
    investments: [],
    loans: [],
    goals,
    purchases: [],
    allocationMode: 'fixed',
  };
}

const monthFor = (result: ReturnType<typeof simulate>, m: number) =>
  result.months[m - 1].goals.find((g) => g.goalId === 'car')!;

describe('a goal marked done', () => {
  const result = simulate(inputWith([goal({ isDone: true, current: 80_000 })]));

  it('takes nothing, in any month', () => {
    expect(monthFor(result, 1).required).toBe(0);
    expect(monthFor(result, 1).contribution).toBe(0);
    expect(monthFor(result, 12).contribution).toBe(0);
  });

  it('keeps the balance it had', () => {
    expect(monthFor(result, 12).balance).toBe(80_000);
  });

  it('hands the money back to the balance left', () => {
    const active = simulate(inputWith([goal({ current: 80_000 })]));
    expect(active.months[0].buffer).toBe(20_000); // 50,000 − 20,000 rent − 10,000
    expect(result.months[0].buffer).toBe(30_000); // the 10,000 is yours again
  });

  it('drops out of the planning figures too', () => {
    const plan = planningTotals(inputWith([goal({ isDone: true })]));
    expect(plan.available).toBe(30_000);
  });
});

describe('a goal that stops funding on a date', () => {
  const result = simulate(inputWith([goal({ contributeUntilMonth: 3 })]));

  it('is funded up to and including that month', () => {
    expect(monthFor(result, 1).contribution).toBe(10_000);
    expect(monthFor(result, 3).contribution).toBe(10_000);
  });

  it('takes nothing afterwards', () => {
    expect(monthFor(result, 4).required).toBe(0);
    expect(monthFor(result, 4).contribution).toBe(0);
  });

  it('keeps what it collected', () => {
    expect(monthFor(result, 12).balance).toBe(30_000);
  });

  it('gives the surplus back from the month after', () => {
    expect(result.months[2].buffer).toBe(20_000); // month 3, still funding
    expect(result.months[3].buffer).toBe(30_000); // month 4, released
  });

  it('counts a stop date already in the past as stopped', () => {
    const past = simulate(inputWith([goal({ contributeUntilMonth: -2 })]));
    expect(monthFor(past, 1).contribution).toBe(0);
    expect(past.months[0].buffer).toBe(30_000);
  });
});

describe('the target date as a hard stop', () => {
  const anchor = new Date(2026, 6, 1); // 1 July 2026

  function goalRow(extra: Partial<GoalRow> = {}): GoalRow {
    return {
      id: 'ef',
      name: 'Emergency Fund',
      target: 3_00_000,
      current_amount: 50_000,
      deadline: '2027-01-01',
      status: 'active',
      contribute_until: null,
      stop_at_deadline: false,
      priority: 1,
      expected_return_pct: 0,
      is_protected: true,
      fixed_contribution: 15_000,
      weight: 1,
      ...extra,
    };
  }

  it('keeps funding an unfilled goal past its target date by default', () => {
    const config = toGoalConfig(goalRow(), anchor);
    expect(config.contributeUntilMonth).toBeUndefined();
  });

  it('stops at the target date when asked to', () => {
    const config = toGoalConfig(goalRow({ stop_at_deadline: true }), anchor);
    // January 2027 is six months after the July anchor.
    expect(config.contributeUntilMonth).toBe(6);
  });

  it('takes whichever stop comes first', () => {
    const config = toGoalConfig(
      goalRow({ stop_at_deadline: true, contribute_until: '2026-11-01' }),
      anchor,
    );
    expect(config.contributeUntilMonth).toBe(4); // November, not January
  });

  it('the emergency fund stops in January and the money is freed', () => {
    // 15,000 a month into an unfilled fund, stopping at the January target.
    const config = toGoalConfig(goalRow({ stop_at_deadline: true }), anchor);
    const result = simulate(inputWith([config]));
    const ef = (m: number) =>
      result.months[m - 1].goals.find((g) => g.goalId === 'ef')!;

    expect(ef(6).contribution).toBeGreaterThan(0); // January, last month funded
    expect(ef(7).contribution).toBe(0); // February onwards, nothing
    expect(ef(12).balance).toBe(ef(6).balance); // and the balance holds
    expect(result.months[6].buffer).toBeGreaterThan(result.months[5].buffer);
  });
});

describe('a goal left to run until it is full', () => {
  it('keeps funding past its target date when it is not full', () => {
    // 10,000 a month at a 3,00,000 target, due in three months: nowhere near
    // enough. With no stop set it carries on until it gets there.
    const result = simulate(
      inputWith([goal({ target: 3_00_000, deadlineMonth: 3 })]),
    );

    expect(monthFor(result, 3).contribution).toBe(10_000); // the target date
    expect(monthFor(result, 4).contribution).toBe(10_000); // straight past it
    expect(monthFor(result, 12).contribution).toBe(10_000);
    expect(monthFor(result, 12).balance).toBe(1_20_000);
  });

  it('still stops of its own accord at the target', () => {
    const result = simulate(inputWith([goal({ target: 25_000 })]));

    expect(monthFor(result, 1).contribution).toBe(10_000);
    expect(monthFor(result, 3).contribution).toBe(5_000); // tops up, no more
    expect(monthFor(result, 4).contribution).toBe(0);
    expect(monthFor(result, 12).balance).toBe(25_000);
  });
});

describe('one goal ending does not starve the others', () => {
  it('passes the freed money to the next goal in line', () => {
    const result = simulate(
      inputWith([
        goal({ id: 'car', name: 'Car', contributeUntilMonth: 2, priority: 1 }),
        goal({ id: 'trip', name: 'Trip', priority: 2, fixedContribution: 5_000 }),
      ]),
    );
    const trip = (m: number) =>
      result.months[m - 1].goals.find((g) => g.goalId === 'trip')!;

    expect(trip(1).contribution).toBe(5_000);
    expect(trip(3).contribution).toBe(5_000); // unchanged; it takes what it needs
    expect(result.months[2].buffer).toBe(25_000); // the car's 10,000 comes back
  });
});
