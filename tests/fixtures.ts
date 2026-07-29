import type { EngineInput, PurchasePlan } from '@/lib/engine';

/**
 * The worked example from the scope of work, §5.
 *
 *   Net salary                 1,20,000
 *   Fixed (rent 25k, home 15k, internet 1k, insurance 2k, subs 1.5k)  -44,500
 *   Education loan EMI                                                -12,000
 *   Variable (food 8k, petrol 4k, travel 3k, shopping 4k, medical 1k) -20,000
 *   Committed SIP                                                     -20,000
 *   Investable surplus                                                 23,500
 */
export function workedExample(): EngineInput {
  return {
    horizonMonths: 36,
    startCorpus: 90_000,
    emergencyFloor: 0,
    annualReturnPct: 0,
    annualInflationPct: 0,
    income: {
      netSalary: 120_000,
      bonusMode: 'lump',
    },
    fixedExpenses: [
      { id: 'rent', name: 'Rent', amount: 25_000 },
      { id: 'home', name: 'Home contribution', amount: 15_000 },
      { id: 'net', name: 'Internet', amount: 1_000 },
      { id: 'ins', name: 'Insurance', amount: 2_000 },
      { id: 'subs', name: 'Subscriptions', amount: 1_500 },
    ],
    variableExpenses: [
      { id: 'food', name: 'Food', amount: 8_000 },
      { id: 'petrol', name: 'Petrol', amount: 4_000 },
      { id: 'travel', name: 'Travel', amount: 3_000 },
      { id: 'shop', name: 'Shopping', amount: 4_000 },
      { id: 'med', name: 'Medical', amount: 1_000 },
    ],
    investments: [{ id: 'sip', name: 'SIP', amount: 20_000 }],
    loans: [
      {
        id: 'edu',
        name: 'Education loan',
        type: 'education',
        emi: 12_000,
        remainingMonths: 48,
        annualRatePct: 4,
        outstanding: 5_00_000,
      },
    ],
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
    ],
    purchases: [],
    allocationMode: 'waterfall',
  };
}

/** AirPods - ₹29,400 on a no-cost EMI of ₹4,900 x 6 months. */
export const airpods: PurchasePlan = {
  id: 'airpods',
  name: 'AirPods',
  price: 29_400,
  mode: 'emi',
  startMonth: 1,
  emiAmount: 4_900,
  emiTenure: 6,
  annualRatePct: 0,
};

/** Watch - ₹18,000, full cash, month 1. */
export const watch: PurchasePlan = {
  id: 'watch',
  name: 'Watch',
  price: 18_000,
  mode: 'cash',
  startMonth: 1,
};
