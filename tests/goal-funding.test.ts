import { describe, expect, it } from 'vitest';
import {
  evaluatePurchase,
  planningTotals,
  simulate,
  type EngineInput,
} from '@/lib/engine';
import { workedExample } from './fixtures';

/**
 * Savings lines and goals are separate commitments: a SIP or a deposit is an
 * outflow, and a goal takes its contribution out of what is left. Pointing one
 * at the other used to be modelled explicitly; goals now carry their own
 * monthly amount instead, so there is only one path through the numbers.
 */
function withEmergencyFund(): EngineInput {
  const input = workedExample();
  input.goals = [
    {
      id: 'ef',
      name: 'Emergency Fund',
      target: 3_00_000,
      current: 90_000,
      deadlineMonth: 12,
      priority: 1,
      isProtected: true,
    },
  ];
  input.investments = [
    { id: 'sip', name: 'SIP', amount: 20_000 },
    { id: 'fd', name: 'Fixed deposit', amount: 10_000 },
  ];
  return input;
}

describe('savings lines alongside a goal', () => {
  it('charges every savings line as an outflow', () => {
    const result = simulate(withEmergencyFund());
    expect(Math.round(result.months[0].investments)).toBe(30_000);
    expect(Math.round(result.months[0].surplus)).toBe(13_500);
  });

  it('funds the goal out of what is left', () => {
    const result = simulate(withEmergencyFund());
    const ef = result.months[0].goals.find((g) => g.goalId === 'ef')!;
    expect(Math.round(ef.contribution)).toBe(13_500);
    expect(Math.round(ef.balance)).toBe(90_000 + 13_500);
  });

  it('runs the goal at the rate its deadline needs', () => {
    const result = simulate(withEmergencyFund());
    const ef = result.months[0].goals.find((g) => g.goalId === 'ef')!;
    // 2,10,000 to go over twelve months.
    expect(Math.round(ef.required)).toBe(17_500);
  });

  it('never gives a goal more than it needs', () => {
    const input = withEmergencyFund();
    input.goals![0].current = 2_95_000; // 5,000 short of the 3,00,000 target
    const result = simulate(input);
    const ef = result.months[0].goals.find((g) => g.goalId === 'ef')!;
    expect(Math.round(ef.contribution)).toBe(5_000);
    expect(Math.round(ef.balance)).toBe(3_00_000);
  });
});

describe('planning totals', () => {
  it('totals every savings line, whatever it is for', () => {
    const plan = planningTotals(withEmergencyFund());
    expect(plan.investments).toBe(30_000); // SIP + FD
    expect(plan.spare).toBe(plan.available - 30_000);
  });
});

describe('evaluating a purchase against goals and savings together', () => {
  it('measures the delay against the goal it actually sets back', () => {
    const impact = evaluatePurchase(withEmergencyFund(), [
      { id: 'tv', name: 'TV', price: 47_000, mode: 'cash', startMonth: 1 },
    ]);
    expect(impact.headlineDelay?.name).toBe('Emergency Fund');
    expect(impact.headlineDelay?.delayMonths).toBeGreaterThan(0);
  });

  it('still costs exactly the purchase price, to the rupee', () => {
    const impact = evaluatePurchase(withEmergencyFund(), [
      { id: 'tv', name: 'TV', price: 47_000, mode: 'cash', startMonth: 1 },
    ]);
    for (const month of [6, 12, 24]) {
      const b = impact.baseline.months[month - 1].corpus;
      const s = impact.scenario.months[month - 1].corpus;
      expect(Math.round(b - s)).toBe(47_000);
    }
  });
});
