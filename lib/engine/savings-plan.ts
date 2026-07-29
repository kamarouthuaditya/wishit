/**
 * "My emergency fund should be ₹1,00,000 — how much is that a month?"
 *
 * Two directions, because people ask it both ways:
 *   - I want it by a date. What do I put aside? -> monthlyFor()
 *   - I can spare ₹X a month. When do I get there? -> monthsAt()
 */

export interface SavingsOption {
  months: number;
  monthly: number;
  /** True when this fits inside the money you actually have spare. */
  affordable: boolean;
  /** Share of spare money this would eat. 1 = all of it. */
  shareOfSpare: number;
}

export interface SavingsPlan {
  target: number;
  current: number;
  remaining: number;
  spare: number;
  /** A few timeframes to choose between. */
  options: SavingsOption[];
  /** Fastest option that still fits inside spare money, if any. */
  soonestAffordable: SavingsOption | null;
  /** Months to get there putting every spare rupee in. null if spare <= 0. */
  monthsAtFullTilt: number | null;
}

export const DEFAULT_TIMEFRAMES = [3, 6, 12, 18, 24, 36];

/** What you must put aside monthly to close the gap in `months`. */
export function monthlyFor(
  target: number,
  current: number,
  months: number,
  annualReturnPct = 0,
): number {
  const remaining = Math.max(0, target - current);
  if (months <= 0) return remaining;

  const r = annualReturnPct / 12 / 100;
  if (r === 0) return remaining / months;

  // Future value of the existing balance, then an annuity for the rest.
  const grown = current * Math.pow(1 + r, months);
  const gap = Math.max(0, target - grown);
  return (gap * r) / (Math.pow(1 + r, months) - 1);
}

/** How many months at `monthly` before you hit the target. null if never. */
export function monthsAt(
  target: number,
  current: number,
  monthly: number,
  annualReturnPct = 0,
): number | null {
  const remaining = Math.max(0, target - current);
  if (remaining === 0) return 0;
  if (monthly <= 0) return null;

  const r = annualReturnPct / 12 / 100;
  if (r === 0) return remaining / monthly;

  // Solve for n in: current(1+r)^n + monthly * ((1+r)^n - 1)/r = target
  const numerator = target * r + monthly;
  const denominator = current * r + monthly;
  if (denominator <= 0) return null;
  return Math.log(numerator / denominator) / Math.log(1 + r);
}

export type ContributionStatus =
  | 'complete'
  | 'unfunded'
  | 'on-track'
  | 'short'
  | 'ahead'
  | 'no-deadline';

export interface ContributionCheck {
  /** What the goal needs each month to land on its target date. */
  required: number | null;
  /** What it is actually being given each month. */
  funding: number;
  /** funding − required. Negative means underfunded. */
  difference: number | null;
  status: ContributionStatus;
  /** Months to reach the target at the current funding. */
  monthsAtFunding: number | null;
  deadlineMonths: number | null;
  /** Positive = lands this many months late. Negative = early. */
  monthsVsDeadline: number | null;
}

/**
 * Reconciles what a goal is actually being fed against what it needs.
 *
 * Tying a ₹15,000 deposit to a ₹1,00,000 emergency fund is only the first half
 * of the question — the second is whether ₹15,000 is the right number. Anything
 * inside a rupee or so of the required figure counts as on track; float noise
 * is not worth a warning.
 */
export function assessContribution(params: {
  target: number;
  current: number;
  /** Money going in each month, from a linked line or a fixed contribution. */
  funding: number;
  /** Months until the target date. Omit if the goal has no deadline. */
  deadlineMonths?: number | null;
  annualReturnPct?: number;
  /** Below this gap, treat the contribution as correct. Default ₹1. */
  tolerance?: number;
}): ContributionCheck {
  const { target, current, funding } = params;
  const rate = params.annualReturnPct ?? 0;
  const tolerance = params.tolerance ?? 1;
  const deadlineMonths = params.deadlineMonths ?? null;

  const monthsAtFunding = monthsAt(target, current, funding, rate);
  const base = {
    funding,
    monthsAtFunding,
    deadlineMonths,
    monthsVsDeadline:
      deadlineMonths != null && monthsAtFunding != null
        ? monthsAtFunding - deadlineMonths
        : null,
  };

  if (target - current <= 0) {
    return { ...base, required: 0, difference: null, status: 'complete' };
  }
  if (deadlineMonths == null || deadlineMonths <= 0) {
    return { ...base, required: null, difference: null, status: 'no-deadline' };
  }

  const required = monthlyFor(target, current, deadlineMonths, rate);
  const difference = funding - required;

  const status: ContributionStatus =
    funding <= 0
      ? 'unfunded'
      : Math.abs(difference) <= tolerance
        ? 'on-track'
        : difference < 0
          ? 'short'
          : 'ahead';

  return { ...base, required, difference, status };
}

export function buildSavingsPlan(params: {
  target: number;
  current: number;
  /** Spare money each month, from planningTotals(). */
  spare: number;
  annualReturnPct?: number;
  timeframes?: number[];
}): SavingsPlan {
  const { target, current, spare } = params;
  const rate = params.annualReturnPct ?? 0;
  const timeframes = params.timeframes ?? DEFAULT_TIMEFRAMES;
  const remaining = Math.max(0, target - current);

  const options: SavingsOption[] = timeframes.map((months) => {
    const monthly = monthlyFor(target, current, months, rate);
    return {
      months,
      monthly,
      affordable: spare > 0 && monthly <= spare,
      shareOfSpare: spare > 0 ? monthly / spare : Infinity,
    };
  });

  return {
    target,
    current,
    remaining,
    spare,
    options,
    soonestAffordable: options.find((o) => o.affordable) ?? null,
    monthsAtFullTilt: monthsAt(target, current, spare, rate),
  };
}
