import { describe, expect, it } from 'vitest';
import {
  compareModes,
  evaluatePurchase,
  healthSnapshot,
  simulate,
  type EngineInput,
} from '@/lib/engine';
import { airpods, watch, workedExample } from './fixtures';

describe('the month-by-month loop', () => {
  it('restores surplus when an EMI ends mid-horizon', () => {
    const result = simulate({ ...workedExample(), purchases: [airpods] });
    expect(Math.round(result.months[5].surplus)).toBe(18_600); // month 6, last EMI
    expect(Math.round(result.months[6].surplus)).toBe(23_500); // month 7, EMI gone
  });

  it('drops the loan EMI out of the outflow when the loan ends', () => {
    const input = workedExample();
    input.loans![0].remainingMonths = 3;
    const result = simulate(input);
    expect(Math.round(result.months[2].surplus)).toBe(23_500);
    expect(Math.round(result.months[3].surplus)).toBe(35_500);
  });

  it('applies effective_from / effective_to to expense lines', () => {
    const input = workedExample();
    input.fixedExpenses!.push({
      id: 'rent-hike',
      name: 'Rent hike',
      amount: 3_000,
      fromMonth: 5,
    });
    const result = simulate(input);
    expect(Math.round(result.months[3].surplus)).toBe(23_500); // month 4
    expect(Math.round(result.months[4].surplus)).toBe(20_500); // month 5 onward
  });
});

describe('bonus modes', () => {
  const withBonus = (mode: 'lump' | 'amortised'): EngineInput => {
    const input = workedExample();
    input.income.bonus = { amount: 1_20_000, month: 4 };
    input.income.bonusMode = mode;
    return input;
  };

  it('lands the lump sum in its actual month and repeats annually', () => {
    const result = simulate(withBonus('lump'));
    expect(Math.round(result.months[2].inflow)).toBe(1_20_000); // month 3
    expect(Math.round(result.months[3].inflow)).toBe(2_40_000); // month 4
    expect(Math.round(result.months[15].inflow)).toBe(2_40_000); // month 16
  });

  it('smooths it across the year in amortised mode', () => {
    const result = simulate(withBonus('amortised'));
    for (const m of [0, 3, 11]) {
      expect(Math.round(result.months[m].inflow)).toBe(1_30_000);
    }
  });

  it('leaves the 12-month total identical either way', () => {
    const lump = simulate(withBonus('lump'));
    const amortised = simulate(withBonus('amortised'));
    const total = (r: typeof lump) =>
      Math.round(r.months.slice(0, 12).reduce((s, m) => s + m.inflow, 0));
    expect(total(lump)).toBe(total(amortised));
  });
});

describe('returns and inflation', () => {
  it('are off by default so the rupee-exact invariant holds', () => {
    const result = simulate(workedExample());
    expect(Math.round(result.months[11].corpus)).toBe(90_000 + 12 * 23_500);
  });

  it('compound the corpus once switched on', () => {
    const flat = simulate(workedExample());
    const growing = simulate({ ...workedExample(), annualReturnPct: 6 });
    expect(growing.months[11].corpus).toBeGreaterThan(flat.months[11].corpus);
  });

  it('drift variable expenses once switched on', () => {
    const drifting = simulate({ ...workedExample(), annualInflationPct: 6 });
    expect(Math.round(drifting.months[0].variable)).toBe(20_000); // month 1 = today
    expect(drifting.months[11].variable).toBeGreaterThan(20_000);
    expect(drifting.months[11].surplus).toBeLessThan(23_500);
  });
});

describe('goal allocation', () => {
  const twoGoals = (): EngineInput => ({
    ...workedExample(),
    goals: [
      {
        id: 'ef',
        name: 'Emergency Fund',
        target: 3_00_000,
        current: 90_000,
        deadlineMonth: 12,
        priority: 1,
        isProtected: true,
      },
      {
        id: 'trip',
        name: 'Japan trip',
        target: 2_00_000,
        current: 0,
        deadlineMonth: 24,
        priority: 2,
      },
    ],
  });

  it('waterfall fills the top goal before spilling over', () => {
    const result = simulate({ ...twoGoals(), allocationMode: 'waterfall' });
    expect(result.months[0].goals[1].contribution).toBe(0);
    // EF completes around month 9, so the trip starts filling right after.
    const first = result.months.findIndex((m) => m.goals[1].contribution > 0);
    expect(first + 1).toBe(9);
  });

  it('proportional splits by weight in the same month', () => {
    const input = twoGoals();
    input.goals![0].weight = 3;
    input.goals![1].weight = 1;
    const result = simulate({ ...input, allocationMode: 'proportional' });
    expect(Math.round(result.months[0].goals[0].contribution)).toBe(17_625);
    expect(Math.round(result.months[0].goals[1].contribution)).toBe(5_875);
  });

  it('fixed honours each goal\'s own contribution', () => {
    const input = twoGoals();
    input.goals![0].fixedContribution = 15_000;
    input.goals![1].fixedContribution = 5_000;
    const result = simulate({ ...input, allocationMode: 'fixed' });
    expect(result.months[0].goals[0].contribution).toBe(15_000);
    expect(result.months[0].goals[1].contribution).toBe(5_000);
  });

  it('starves the lowest-priority goal first when a lump sum lands', () => {
    // Month 20: EF is long since funded and the trip has enough to absorb it.
    const impact = evaluatePurchase(twoGoals(), [
      { id: 'tv', name: 'TV', price: 60_000, mode: 'cash', startMonth: 20 },
    ]);
    const scen = impact.scenario.months[19];
    const base = impact.baseline.months[19];
    expect(Math.round(base.goals[1].balance - scen.goals[1].balance)).toBe(60_000);
    expect(Math.round(scen.goals[0].balance)).toBe(Math.round(base.goals[0].balance));
  });

  it('falls back to the protected goal only once the others are drained', () => {
    // Month 10: the trip holds ~25,000, so 35,000 has to come out of the EF.
    const impact = evaluatePurchase(twoGoals(), [
      { id: 'tv', name: 'TV', price: 60_000, mode: 'cash', startMonth: 10 },
    ]);
    const scen = impact.scenario.months[9];
    const base = impact.baseline.months[9];
    expect(Math.round(scen.goals[1].balance)).toBe(0); // trip drained first
    expect(scen.goals[0].balance).toBeLessThan(base.goals[0].balance);
    const drop =
      base.goals[0].balance - scen.goals[0].balance +
      (base.goals[1].balance - scen.goals[1].balance);
    expect(Math.round(drop)).toBe(60_000);
  });
});

describe('breach flags', () => {
  it('flags the corpus dipping below the emergency floor', () => {
    const input = { ...workedExample(), emergencyFloor: 1_00_000 };
    const impact = evaluatePurchase(input, [
      { id: 'big', name: 'Big TV', price: 80_000, mode: 'cash', startMonth: 1 },
    ]);
    const breach = impact.newBreaches.find((b) => b.kind === 'corpus-below-floor');
    expect(breach?.severity).toBe('red');
    expect(breach?.month).toBe(1);
  });

  it('flags surplus going negative', () => {
    const impact = evaluatePurchase(workedExample(), [
      {
        id: 'car',
        name: 'Car',
        price: 12_00_000,
        mode: 'emi',
        startMonth: 1,
        emiTenure: 24,
        annualRatePct: 9,
      },
    ]);
    expect(impact.newBreaches.some((b) => b.kind === 'negative-surplus')).toBe(true);
    expect(impact.newBreaches.some((b) => b.kind === 'emi-load-high')).toBe(true);
  });

  it('flags a goal that newly misses its deadline', () => {
    const input = workedExample();
    input.goals![0].deadlineMonth = 10;
    const impact = evaluatePurchase(input, [airpods, watch]);
    expect(impact.headlineDelay?.newlyMissesDeadline).toBe(true);
    expect(
      impact.newBreaches.some((b) => b.kind === 'goal-missed-deadline'),
    ).toBe(true);
  });

  it('reports the first month of each breach, not every month', () => {
    const input = { ...workedExample(), emergencyFloor: 5_00_000 };
    const result = simulate(input);
    const floor = result.breaches.filter((b) => b.kind === 'corpus-below-floor');
    expect(floor).toHaveLength(1);
    expect(floor[0].month).toBe(1);
  });
});

describe('earliest safe purchase date', () => {
  it('is 0 when the purchase is safe today', () => {
    const impact = evaluatePurchase(workedExample(), [airpods]);
    expect(impact.earliestSafeDelay).toBe(0);
  });

  it('finds the month the breach stops happening', () => {
    // Floor sits just under the opening corpus, so the baseline is clean and
    // only the purchase pushes it under.
    const input = { ...workedExample(), emergencyFloor: 1_00_000 };
    const item = {
      id: 'tv',
      name: 'TV',
      price: 60_000,
      mode: 'cash' as const,
      startMonth: 1,
    };
    const impact = evaluatePurchase(input, [item]);
    expect(impact.earliestSafeDelay).toBeGreaterThan(0);

    // Re-running at that delay really is clean.
    const delayed = evaluatePurchase(input, [
      { ...item, startMonth: 1 + impact.earliestSafeDelay! },
    ]);
    expect(delayed.newBreaches.filter((b) => b.severity === 'red')).toHaveLength(0);
  });
});

describe('save-then-buy', () => {
  it('ring-fences until the price is reached, then buys', () => {
    const result = simulate({
      ...workedExample(),
      purchases: [
        {
          id: 'lens',
          name: 'Lens',
          price: 60_000,
          mode: 'save-then-buy',
          startMonth: 1,
          monthlySaving: 10_000,
        },
      ],
    });
    expect(result.months[4].ringFenced).toBe(10_000); // month 5, still saving
    expect(result.months[5].ringFenced).toBe(10_000); // month 6, pot hits 60,000
    expect(result.months[6].ringFenced).toBe(0); // month 7, done
    expect(Math.round(result.months[6].surplus)).toBe(23_500);
  });

  it('flags an item the ring-fence never funds inside the horizon', () => {
    const result = simulate({
      ...workedExample(),
      horizonMonths: 12,
      purchases: [
        {
          id: 'house',
          name: 'House deposit',
          price: 20_00_000,
          mode: 'save-then-buy',
          startMonth: 1,
          monthlySaving: 10_000,
        },
      ],
    });
    expect(result.breaches.some((b) => b.kind === 'purchase-unfunded')).toBe(true);
  });
});

describe('scenario stacking', () => {
  it('catches three individually-affordable purchases that are collectively ruinous', () => {
    const input = { ...workedExample(), emergencyFloor: 50_000 };
    const items = [
      { id: 'a', name: 'Phone', price: 40_000, mode: 'cash' as const, startMonth: 1 },
      { id: 'b', name: 'Laptop', price: 45_000, mode: 'cash' as const, startMonth: 1 },
      { id: 'c', name: 'Bike', price: 50_000, mode: 'cash' as const, startMonth: 1 },
    ];

    for (const item of items) {
      const solo = evaluatePurchase(input, [item]);
      expect(solo.newBreaches.filter((b) => b.severity === 'red')).toHaveLength(0);
    }

    const stacked = evaluatePurchase(input, items);
    expect(stacked.newBreaches.some((b) => b.severity === 'red')).toBe(true);
  });
});

describe('mode comparison', () => {
  it('shows cash winning on total cost and losing on liquidity', () => {
    const rows = compareModes(
      workedExample(),
      { id: 'x', name: 'Laptop', price: 1_20_000, mode: 'cash', startMonth: 1 },
      { tenure: 12, ratePct: 14 },
    );
    expect(rows).toHaveLength(4);

    const cash = rows.find((r) => r.mode === 'cash')!;
    const emi = rows.find((r) => r.mode === 'emi')!;

    // EMI costs more in rupees...
    expect(emi.totalPaid).toBeGreaterThan(cash.totalPaid);
    expect(emi.totalPaid - cash.totalPaid).toBeGreaterThan(8_000); // 14% interest
    // ...but never puts the corpus on the floor the way a cash hit does.
    expect(cash.lowestCorpus).toBeLessThan(emi.lowestCorpus);
    expect(cash.monthlyOutflow).toBe(0);
    expect(Math.round(emi.monthlyOutflow)).toBe(10_774);
    // Every mode ends up owning the thing at some point in the horizon.
    expect(rows.every((r) => r.ownedInMonth != null)).toBe(true);
  });
});

describe('healthSnapshot', () => {
  it('produces the dashboard hero numbers', () => {
    const health = healthSnapshot({ ...workedExample(), emergencyFloor: 50_000 });
    expect(Math.round(health.investableSurplus)).toBe(23_500);
    expect(health.surplusRate).toBeCloseTo(0.1958, 3);
    expect(Math.round(health.monthlyBurn)).toBe(76_500);
    expect(health.runwayMonths).toBeCloseTo(90_000 / 76_500, 3);
    expect(health.floorHeadroom).toBe(40_000);
    expect(health.goalHealth).toBe('good');
  });

  it('turns the light red when the floor is breached', () => {
    const health = healthSnapshot({
      ...workedExample(),
      startCorpus: 20_000,
      emergencyFloor: 1_00_000,
    });
    expect(health.goalHealth).toBe('bad');
  });
});
