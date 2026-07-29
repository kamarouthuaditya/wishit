import { describe, expect, it } from 'vitest';
import { assessContribution } from '@/lib/engine';

/**
 * The reported case: a ₹15,000 deposit tied to a goal, with nothing telling you
 * whether ₹15,000 is actually the right number.
 */
describe('checking a contribution against what the goal needs', () => {
  const goal = { target: 1_00_000, current: 0, deadlineMonths: 6 };

  it('flags a deposit that is short of the target date', () => {
    const check = assessContribution({ ...goal, funding: 15_000 });

    expect(check.status).toBe('short');
    expect(Math.round(check.required!)).toBe(16_667);
    expect(Math.round(check.difference!)).toBe(-1_667);
    // 1,00,000 at 15,000 a month is 6.67 months against a 6-month deadline.
    expect(check.monthsAtFunding).toBeCloseTo(6.67, 1);
    expect(check.monthsVsDeadline).toBeCloseTo(0.67, 1);
  });

  it('flags a deposit that is more than needed', () => {
    const check = assessContribution({ ...goal, funding: 20_000 });

    expect(check.status).toBe('ahead');
    expect(Math.round(check.difference!)).toBe(3_333);
    expect(check.monthsAtFunding).toBe(5);
    expect(check.monthsVsDeadline).toBe(-1); // a month early
  });

  it('calls it on track when the amount matches', () => {
    const check = assessContribution({ ...goal, funding: 1_00_000 / 6 });
    expect(check.status).toBe('on-track');
    expect(Math.abs(check.difference!)).toBeLessThan(1);
  });

  it('treats sub-rupee float noise as on track, not a warning', () => {
    const check = assessContribution({ ...goal, funding: 1_00_000 / 6 + 0.4 });
    expect(check.status).toBe('on-track');
  });

  it('says nothing is going in when funding is zero', () => {
    const check = assessContribution({ ...goal, funding: 0 });
    expect(check.status).toBe('unfunded');
    expect(check.monthsAtFunding).toBeNull();
  });

  it('reports completion rather than a shortfall once the target is met', () => {
    const check = assessContribution({
      target: 1_00_000,
      current: 1_00_000,
      funding: 15_000,
      deadlineMonths: 6,
    });
    expect(check.status).toBe('complete');
    expect(check.monthsAtFunding).toBe(0);
  });

  it('still projects a date when the goal has no deadline', () => {
    const check = assessContribution({
      target: 1_00_000,
      current: 25_000,
      funding: 15_000,
      deadlineMonths: null,
    });
    expect(check.status).toBe('no-deadline');
    expect(check.required).toBeNull();
    expect(check.monthsAtFunding).toBe(5);
  });

  it('counts the head start you already have', () => {
    const check = assessContribution({
      target: 1_00_000,
      current: 40_000,
      funding: 10_000,
      deadlineMonths: 6,
    });
    expect(Math.round(check.required!)).toBe(10_000); // 60,000 over 6 months
    expect(check.status).toBe('on-track');
  });

  it('asks for less once the balance earns a return', () => {
    const flat = assessContribution({ ...goal, funding: 15_000, annualReturnPct: 0 });
    const growing = assessContribution({
      ...goal,
      funding: 15_000,
      annualReturnPct: 8,
    });
    expect(growing.required!).toBeLessThan(flat.required!);
  });

  it('says never when the contribution cannot reach the target at all', () => {
    const check = assessContribution({
      target: 1_00_000,
      current: 0,
      funding: 0,
      deadlineMonths: 6,
    });
    expect(check.monthsAtFunding).toBeNull();
    expect(check.status).toBe('unfunded');
  });
});
