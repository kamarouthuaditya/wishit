import { describe, expect, it } from 'vitest';
import { buildWaterfall, evaluatePurchase, simulate } from '@/lib/engine';
import { airpods, watch, workedExample } from './fixtures';

const rupee = (n: number) => Math.round(n);

describe('worked example - §5 of the scope of work', () => {
  it('resolves to an investable surplus of ₹23,500', () => {
    const wf = buildWaterfall(workedExample());
    expect(rupee(wf.totalInflow)).toBe(1_20_000);
    expect(rupee(wf.fixed)).toBe(44_500);
    expect(rupee(wf.committedDebt)).toBe(12_000);
    expect(rupee(wf.variable)).toBe(20_000);
    expect(rupee(wf.freeCashflow)).toBe(43_500);
    expect(rupee(wf.committedInvestments)).toBe(20_000);
    expect(rupee(wf.investableSurplus)).toBe(23_500);
  });

  it('carries on past the surplus to what goals leave behind', () => {
    const wf = buildWaterfall(workedExample());
    expect(rupee(wf.goalContributions)).toBe(17_500);
    expect(rupee(wf.balanceLeft)).toBe(6_000);
    expect(wf.rows.at(-1)).toEqual({
      label: 'Balance left',
      amount: wf.balanceLeft,
      kind: 'subtotal',
    });
  });

  it('hits the Emergency Fund in month 8.9 on the baseline', () => {
    const result = simulate(workedExample());
    expect(result.goals[0].completionMonth).toBeCloseTo(8.94, 1);
    expect(result.goals[0].missedDeadline).toBe(false);
  });

  it('reproduces the baseline vs scenario corpus table', () => {
    const impact = evaluatePurchase(workedExample(), [airpods, watch]);
    const at = (m: number) => impact.checkpoints.find((c) => c.month === m)!;

    expect(rupee(at(3).baselineCorpus)).toBe(1_60_500);
    expect(rupee(at(3).scenarioCorpus)).toBe(1_27_800);
    expect(rupee(at(3).corpusDelta)).toBe(-32_700);

    expect(rupee(at(6).baselineCorpus)).toBe(2_31_000);
    expect(rupee(at(6).scenarioCorpus)).toBe(1_83_600);
    expect(rupee(at(6).corpusDelta)).toBe(-47_400);

    expect(rupee(at(9).baselineCorpus)).toBe(3_01_500);
    expect(rupee(at(9).scenarioCorpus)).toBe(2_54_100);
    expect(rupee(at(9).corpusDelta)).toBe(-47_400);

    expect(rupee(at(12).baselineCorpus)).toBe(3_72_000);
    expect(rupee(at(12).scenarioCorpus)).toBe(3_24_600);
    expect(rupee(at(12).corpusDelta)).toBe(-47_400);
  });

  it('delays the Emergency Fund by 2.0 months, not the 12.3 a flat divide gives', () => {
    const impact = evaluatePurchase(workedExample(), [airpods, watch]);
    const ef = impact.headlineDelay!;

    expect(ef.baselineMonth).toBeCloseTo(8.9, 1);
    expect(ef.scenarioMonth).toBeCloseTo(11.0, 1);
    expect(ef.delayMonths).toBeCloseTo(2.0, 1);

    // Still inside the 12-month deadline. The flat divide,
    // (3,00,000 - 72,000) / 18,600 = 12.3, would have called this a miss.
    expect(ef.scenarioMonth!).toBeLessThan(12);
    expect(impact.scenario.goals[0].missedDeadline).toBe(false);

    const flatDivide = (3_00_000 - 72_000) / 18_600;
    expect(flatDivide).toBeGreaterThan(12);
  });

  it('costs ₹47,400 in total and reports the worst-month buffer', () => {
    const impact = evaluatePurchase(workedExample(), [airpods, watch]);
    expect(rupee(impact.totalCost)).toBe(47_400);
    // Surplus 18,600 against a 17,500 required contribution in months 1-6.
    expect(rupee(impact.confidence.worstBuffer)).toBe(1_100);
    expect(impact.confidence.worstMonth).toBe(1);
    expect(impact.earliestSafeDelay).toBe(0); // no red breach today
    expect(impact.headline).toContain('🟡');
  });
});

describe('the §5 rupee-exact invariant', () => {
  it('corpus delta after all payments complete equals total spend, to the rupee', () => {
    // With returns at 0%, month 12 is past the last EMI (month 6), so the gap
    // between baseline and scenario must be exactly 29,400 + 18,000.
    const impact = evaluatePurchase(workedExample(), [airpods, watch]);
    for (const month of [7, 12, 24, 36]) {
      const b = impact.baseline.months[month - 1].corpus;
      const s = impact.scenario.months[month - 1].corpus;
      expect(rupee(b - s)).toBe(29_400 + 18_000);
    }
  });

  it('holds for every purchase mode', () => {
    const input = workedExample();
    const price = 60_000;
    const modes = [
      { id: 'a', name: 'Cash', price, mode: 'cash' as const, startMonth: 1 },
      {
        id: 'b',
        name: 'EMI',
        price,
        mode: 'emi' as const,
        startMonth: 1,
        emiTenure: 10,
        annualRatePct: 0,
      },
      {
        id: 'c',
        name: 'Down + EMI',
        price,
        mode: 'down-payment-emi' as const,
        startMonth: 1,
        downPayment: 20_000,
        emiTenure: 10,
        annualRatePct: 0,
      },
      {
        id: 'd',
        name: 'Save then buy',
        price,
        mode: 'save-then-buy' as const,
        startMonth: 1,
        monthlySaving: 7_000,
      },
    ];

    for (const plan of modes) {
      const impact = evaluatePurchase(input, [plan]);
      const b = impact.baseline.months[35].corpus;
      const s = impact.scenario.months[35].corpus;
      expect(rupee(b - s), `mode ${plan.mode}`).toBe(price);
    }
  });
});
