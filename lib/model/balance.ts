import { buildWaterfall, planningTotals } from '@/lib/engine';
import { toEngineInput } from '@/lib/model/to-engine';
import type { Snapshot } from '@/lib/db/types';

/**
 * The one number the app keeps coming back to: what is left each month once
 * expenses, EMIs, savings, committed purchases and goal contributions have been
 * taken out.
 *
 * Every page quotes this same figure, so it is computed here rather than
 * re-derived per page — two pages disagreeing about the balance is worse than
 * either of them being slightly wrong.
 *
 * Everything here is what this month actually costs. A half-yearly gym is its
 * whole bill in the month it renews and nothing in the five between, because
 * that is how it is paid — out of that month's salary, in one go, not set aside
 * in sixths. Every figure comes off the simulation's first month, so the
 * dashboard cashflow card and this agree line for line.
 */
export interface MonthlyBalance {
  income: number;
  /** Fixed plus variable. EMIs are separate because they end. */
  expenses: number;
  loanEmis: number;
  /** Savings lines plus goal contributions — money kept, not spent. */
  savings: number;
  /** EMIs and ring-fenced saving for wishlist items marked committed. */
  wishlist: number;
  /** The goal share of `savings`, at the rate each goal needs. */
  goalContributions: number;
  /** What is left after all of it. Negative means overcommitted. */
  balance: number;
  /**
   * Budget lines dated to start after this month, at what they will be billed.
   * Not in any figure above — they are not costing anything yet — but shown, so
   * a line you have entered never looks silently ignored.
   */
  notYetStarted: number;
  /**
   * Running lines that are not billed this month: the half-yearly gym between
   * renewals. Also not in any figure above, and worth showing for the opposite
   * reason — a month with no renewals in it is roomy, not rich.
   */
  notDueThisMonth: number;
}

/**
 * What goals take each month. This is the rate they *need* — the deadline
 * run-rate, or the fixed amount for a goal without one — not what the allocator
 * happens to sweep into them. In priority order the allocator hands a goal
 * every spare rupee it can still absorb, which would leave the balance at zero
 * and tell you nothing.
 */
export function goalContributionTotal(snapshot: Snapshot): number {
  const { input } = toEngineInput(snapshot);
  return buildWaterfall(input).goalContributions;
}

export interface BalanceRow {
  label: string;
  amount: number;
  kind: 'inflow' | 'outflow' | 'subtotal';
}

/**
 * The balance, spelled out line by line.
 *
 * Derived from the same object the header quotes, so the cashflow card cannot
 * drift from the figure above it. It drifted twice before this existed: the
 * card was built from the simulation's first month, which charges an annual
 * bonus in the month it lands and a half-yearly bill in full, while the header
 * averaged both. There is one basis now — the simulation's — and the averaging
 * is gone, so the two cannot disagree about a renewal.
 *
 * What that costs is a figure that moves between months. The projection table
 * is where the whole run is visible at once.
 */
export function balanceRows(balance: MonthlyBalance): BalanceRow[] {
  const available =
    balance.income - balance.expenses - balance.loanEmis;
  const savingsOnly = balance.savings - balance.goalContributions;

  const rows: BalanceRow[] = [
    { label: 'Income', amount: balance.income, kind: 'inflow' },
    { label: 'Expenses', amount: -balance.expenses, kind: 'outflow' },
  ];

  if (balance.loanEmis > 0) {
    rows.push({ label: 'Loan EMIs', amount: -balance.loanEmis, kind: 'outflow' });
  }

  rows.push({ label: 'Available', amount: available, kind: 'subtotal' });

  if (savingsOnly > 0) {
    rows.push({
      label: 'Savings & investments',
      amount: -savingsOnly,
      kind: 'outflow',
    });
  }
  if (balance.wishlist > 0) {
    rows.push({
      label: 'Wishlist commitments',
      amount: -balance.wishlist,
      kind: 'outflow',
    });
  }
  if (balance.goalContributions > 0) {
    rows.push({
      label: 'Goal contributions',
      amount: -balance.goalContributions,
      kind: 'outflow',
    });
  }

  rows.push({ label: 'Balance left', amount: balance.balance, kind: 'subtotal' });
  return rows;
}

export function monthlyBalance(snapshot: Snapshot): MonthlyBalance {
  const { input } = toEngineInput(snapshot);
  const plan = planningTotals(input);
  const waterfall = buildWaterfall(input);

  const savings = plan.investments + waterfall.goalContributions;
  const balance =
    plan.available - savings - waterfall.wishlistEmis;

  return {
    income: plan.income,
    expenses: plan.fixed + plan.variable,
    loanEmis: plan.loanEmis,
    savings,
    wishlist: waterfall.wishlistEmis,
    goalContributions: waterfall.goalContributions,
    balance,
    notYetStarted: plan.upcoming.total,
    notDueThisMonth: plan.notDueThisMonth,
  };
}
