import { describe, expect, it } from 'vitest';
import {
  buildSavingsPlan,
  isDue,
  monthlyFor,
  monthsAt,
  planningTotals,
  simulate,
} from '@/lib/engine';
import { workedExample } from './fixtures';

describe('bills that are not monthly', () => {
  const gym = {
    id: 'gym',
    name: 'Gym',
    amount: 9_000,
    fromMonth: 1,
    everyMonths: 6,
  };

  it('charges every 6 months, not every month', () => {
    expect(isDue(gym, 1)).toBe(true);
    expect(isDue(gym, 2)).toBe(false);
    expect(isDue(gym, 6)).toBe(false);
    expect(isDue(gym, 7)).toBe(true);
    expect(isDue(gym, 13)).toBe(true);
  });

  it('hits the surplus in full in its due month and not at all otherwise', () => {
    const input = workedExample();
    input.fixedExpenses!.push(gym);
    const result = simulate(input);

    expect(Math.round(result.months[0].surplus)).toBe(23_500 - 9_000); // month 1
    expect(Math.round(result.months[1].surplus)).toBe(23_500); // month 2
    expect(Math.round(result.months[6].surplus)).toBe(23_500 - 9_000); // month 7
  });

  it('costs the same over a year whichever way it is billed', () => {
    const yearly = { ...gym, amount: 18_000, everyMonths: 12 };
    const monthly = { ...gym, amount: 1_500, everyMonths: 1 };

    const totalFor = (line: typeof gym) => {
      const input = workedExample();
      input.fixedExpenses!.push(line);
      return Math.round(
        simulate(input)
          .months.slice(0, 12)
          .reduce((sum, m) => sum + m.fixed, 0),
      );
    };

    expect(totalFor(yearly)).toBe(totalFor(monthly));
  });

  it('still respects the stop date', () => {
    const result = simulate({
      ...workedExample(),
      fixedExpenses: [{ ...gym, toMonth: 6 }],
    });
    expect(result.months[0].fixed).toBe(9_000); // month 1, due
    expect(result.months[6].fixed).toBe(0); // month 7, line has ended
  });

  it('leaves the rupee-exact invariant alone when nothing is periodic', () => {
    const result = simulate(workedExample());
    expect(Math.round(result.months[11].corpus)).toBe(90_000 + 12 * 23_500);
  });
});

describe('planning totals', () => {
  it('charges a periodic bill in full in the month it renews', () => {
    const input = workedExample();
    input.fixedExpenses!.push({
      id: 'gym',
      name: 'Gym',
      amount: 9_000,
      fromMonth: 1,
      everyMonths: 6,
    });

    const plan = planningTotals(input);
    expect(plan.income).toBe(1_20_000);
    expect(plan.fixed).toBe(44_500 + 9_000); // renewal month: the whole bill
    expect(plan.variable).toBe(20_000);
    expect(plan.loanEmis).toBe(12_000);
    expect(plan.available).toBe(1_20_000 - 53_500 - 20_000 - 12_000);
    expect(plan.spare).toBe(plan.available - 20_000); // less the SIP
    expect(plan.notDueThisMonth).toBe(0);
  });

  it('leaves it out of the months between renewals, and says so', () => {
    const input = workedExample();
    // Renews in month 3, so month 1 — the month being planned — is free of it.
    input.fixedExpenses!.push({
      id: 'gym',
      name: 'Gym',
      amount: 9_000,
      fromMonth: 3,
      beginsMonth: -3,
      everyMonths: 6,
    });

    const plan = planningTotals(input);
    expect(plan.fixed).toBe(44_500);
    expect(plan.notDueThisMonth).toBe(9_000);
    // Not upcoming: the line is running, it is simply not billed this month.
    expect(plan.upcoming.fixed).toBe(0);
  });

  it('counts a lump bonus only in the month it lands', () => {
    const input = workedExample();
    input.income.bonus = { amount: 1_20_000, month: 4 };
    expect(planningTotals(input).income).toBe(1_20_000);

    input.income.bonus = { amount: 1_20_000, month: 1 };
    expect(planningTotals(input).income).toBe(2_40_000);
  });

  it('still spreads a bonus the profile asked to amortise', () => {
    const input = workedExample();
    input.income.bonus = { amount: 1_20_000, month: 4 };
    input.income.bonusMode = 'amortised';
    expect(planningTotals(input).income).toBe(1_30_000);
  });
});

describe('how much a month to reach a target', () => {
  it('splits the gap evenly at 0% return', () => {
    expect(monthlyFor(1_00_000, 0, 10)).toBe(10_000);
    expect(monthlyFor(1_00_000, 40_000, 12)).toBe(5_000);
  });

  it('asks for less once the money earns something', () => {
    const flat = monthlyFor(1_00_000, 0, 24, 0);
    const growing = monthlyFor(1_00_000, 0, 24, 8);
    expect(growing).toBeLessThan(flat);
  });

  it('is the inverse of how long it takes', () => {
    const monthly = monthlyFor(1_00_000, 20_000, 16);
    expect(monthsAt(1_00_000, 20_000, monthly)).toBeCloseTo(16, 6);
  });

  it('says never when nothing is being put aside', () => {
    expect(monthsAt(1_00_000, 0, 0)).toBeNull();
    expect(monthsAt(1_00_000, 1_00_000, 0)).toBe(0); // already there
  });
});

describe('the savings plan shown on a goal', () => {
  const plan = buildSavingsPlan({ target: 1_00_000, current: 20_000, spare: 10_000 });

  it('prices every timeframe against what is actually spare', () => {
    const at12 = plan.options.find((o) => o.months === 12)!;
    expect(at12.monthly).toBeCloseTo(6_666.67, 1);
    expect(at12.affordable).toBe(true);
    expect(at12.shareOfSpare).toBeCloseTo(0.667, 2);

    const at3 = plan.options.find((o) => o.months === 3)!;
    expect(Math.round(at3.monthly)).toBe(26_667);
    expect(at3.affordable).toBe(false);
  });

  it('picks the soonest one that fits', () => {
    expect(plan.soonestAffordable?.months).toBe(12);
  });

  it('says how fast it goes at full tilt', () => {
    expect(plan.monthsAtFullTilt).toBe(8); // 80,000 left at 10,000 a month
  });

  it('reports nothing reachable when there is no spare money', () => {
    const broke = buildSavingsPlan({ target: 1_00_000, current: 0, spare: 0 });
    expect(broke.soonestAffordable).toBeNull();
    expect(broke.monthsAtFullTilt).toBeNull();
    expect(broke.options.every((o) => !o.affordable)).toBe(true);
  });

  it('reports nothing left to do once the target is met', () => {
    const done = buildSavingsPlan({ target: 1_00_000, current: 1_20_000, spare: 5_000 });
    expect(done.remaining).toBe(0);
    expect(done.monthsAtFullTilt).toBe(0);
  });
});
