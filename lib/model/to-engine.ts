import {
  monthAnchor,
  toMonthOffset,
  type EngineInput,
  type GoalConfig,
  type LoanLine,
  type PurchasePlan,
  type RecurringLine,
} from '@/lib/engine';
import type {
  ExpenseItemRow,
  GoalRow,
  LoanRow,
  Snapshot,
  WishlistItemRow,
} from '@/lib/db/types';
import { now as clockNow } from '@/lib/clock';

/**
 * Rows -> EngineInput. The single boundary where dates become month offsets.
 */

export function toRecurring(row: ExpenseItemRow, anchor: Date): RecurringLine {
  const from = toMonthOffset(row.effective_from, anchor);
  const to = row.effective_to ? toMonthOffset(row.effective_to, anchor) : undefined;
  const every = Math.max(1, Number(row.frequency_months ?? 1));

  // A line that started in the past keeps its billing rhythm: walk the cycle
  // forward from the original start so a yearly gym bill lands in the right
  // month, not in month 1 just because that is when we start looking.
  let fromMonth = from;
  if (fromMonth < 1) {
    const cyclesElapsed = Math.ceil((1 - fromMonth) / every);
    fromMonth += cyclesElapsed * every;
  }

  return {
    id: row.id,
    name: row.name,
    amount: Number(row.amount),
    fromMonth,
    toMonth: to != null ? to : undefined,
    everyMonths: every,
    beginsMonth: from,
  };
}

export function toLoanLine(row: LoanRow, anchor: Date): LoanLine {
  const startOffset = toMonthOffset(row.start_date, anchor);
  const elapsed = Math.max(0, -startOffset);
  const remaining = Math.max(0, row.tenure_months - elapsed);
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    emi: Number(row.emi),
    startMonth: Math.max(1, startOffset),
    remainingMonths: remaining,
    annualRatePct: Number(row.annual_rate_pct),
    outstanding: Number(row.outstanding),
  };
}

/**
 * The last month a goal is funded, from whichever of its two stop rules bites
 * first: an explicit "stop after" date, or the target date when it has been
 * marked as a hard stop. Undefined means fund it until it is full.
 */
function stopMonth(row: GoalRow, anchor: Date): number | undefined {
  const candidates: number[] = [];
  if (row.contribute_until) {
    candidates.push(toMonthOffset(row.contribute_until, anchor));
  }
  if (row.stop_at_deadline && row.deadline) {
    candidates.push(toMonthOffset(row.deadline, anchor));
  }
  return candidates.length > 0 ? Math.min(...candidates) : undefined;
}

export function toGoalConfig(row: GoalRow, anchor: Date): GoalConfig {
  return {
    id: row.id,
    name: row.name,
    target: Number(row.target),
    current: Number(row.current_amount),
    deadlineMonth: row.deadline
      ? Math.max(1, toMonthOffset(row.deadline, anchor))
      : undefined,
    // A row written before the lifecycle columns existed has none of these, and
    // an absent status means the goal is simply still running.
    isDone: row.status === 'done',
    contributeUntilMonth: stopMonth(row, anchor),
    priority: row.priority,
    expectedReturnPct: Number(row.expected_return_pct),
    isProtected: row.is_protected,
    fixedContribution:
      row.fixed_contribution != null ? Number(row.fixed_contribution) : undefined,
    weight: Number(row.weight),
  };
}

export function toPurchasePlan(row: WishlistItemRow, anchor: Date): PurchasePlan {
  const start =
    row.purchase_month ??
    (row.target_date ? Math.max(1, toMonthOffset(row.target_date, anchor)) : 1);
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    mode: row.purchase_mode,
    startMonth: start,
    emiAmount: row.emi_amount != null ? Number(row.emi_amount) : undefined,
    emiTenure: row.emi_tenure ?? undefined,
    downPayment: row.down_payment != null ? Number(row.down_payment) : undefined,
    monthlySaving:
      row.monthly_saving != null ? Number(row.monthly_saving) : undefined,
    annualRatePct: row.is_no_cost ? 0 : Number(row.annual_rate_pct),
  };
}

export interface EngineBuild {
  input: EngineInput;
  anchor: Date;
}

/**
 * Baseline input: committed wishlist items only. `planned` and `idea` items are
 * simulation-only, which is what keeps the dashboard trustworthy.
 */
export function toEngineInput(snapshot: Snapshot, now = clockNow()): EngineBuild {
  const anchor = monthAnchor(now);
  const { profile } = snapshot;

  const salaryRows = snapshot.income.filter((i) => i.type === 'salary');
  const netSalary = salaryRows.reduce((sum, i) => sum + Number(i.amount), 0);
  const salarySteps = salaryRows
    .map((i) => ({
      fromMonth: Math.max(1, toMonthOffset(i.effective_from, anchor)),
      amount: Number(i.amount),
    }))
    .filter((s) => s.fromMonth > 1)
    .sort((a, b) => a.fromMonth - b.fromMonth);

  const bonusRow = snapshot.income.find((i) => i.type === 'bonus');
  const otherIncome: RecurringLine[] = snapshot.income
    .filter((i) => i.type === 'other')
    .map((i) => ({
      id: i.id,
      name: i.label || 'Other income',
      amount: Number(i.amount),
      fromMonth: Math.max(1, toMonthOffset(i.effective_from, anchor)),
      toMonth: i.effective_to
        ? toMonthOffset(i.effective_to, anchor)
        : undefined,
    }));

  const byType = (type: ExpenseItemRow['type']) =>
    snapshot.expenses
      .filter((e) => e.type === type)
      .map((e) => toRecurring(e, anchor));

  const input: EngineInput = {
    horizonMonths: profile.horizon_months,
    startCorpus: Number(profile.liquid_corpus),
    emergencyFloor: Number(profile.emergency_floor),
    annualReturnPct: Number(profile.annual_return_pct),
    annualInflationPct: Number(profile.annual_inflation_pct),
    income: {
      netSalary,
      salarySteps: salarySteps.length > 0 ? salarySteps : undefined,
      otherIncome,
      bonus: bonusRow
        ? {
            amount: Number(bonusRow.amount),
            month: Math.max(1, bonusRow.bonus_month ?? 1),
          }
        : undefined,
      bonusMode: profile.bonus_mode,
    },
    fixedExpenses: byType('fixed'),
    variableExpenses: byType('variable'),
    investments: byType('investment'),
    loans: snapshot.loans
      .map((l) => toLoanLine(l, anchor))
      .filter((l) => l.remainingMonths > 0),
    goals: snapshot.goals.map((g) => toGoalConfig(g, anchor)),
    purchases: snapshot.wishlist
      .filter((w) => w.status === 'committed')
      .map((w) => toPurchasePlan(w, anchor)),
    allocationMode: profile.allocation_mode,
  };

  return { input, anchor };
}

/** Wishlist items that are simulation-only (not yet in the baseline). */
export function candidatePlans(
  snapshot: Snapshot,
  ids: string[],
  anchor: Date,
): PurchasePlan[] {
  return snapshot.wishlist
    .filter((w) => ids.includes(w.id))
    .map((w) => toPurchasePlan(w, anchor));
}
