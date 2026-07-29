import 'server-only';
import { driver } from '@/lib/db/driver';
import { toEngineInput } from '@/lib/model/to-engine';
import { simulate } from '@/lib/engine';
import type { LoanRow, MonthlySnapshotRow, Snapshot } from '@/lib/db/types';
import { now as clockNow } from '@/lib/clock';

/**
 * Monthly snapshots exist so trends read history instead of recomputing it.
 * Without them, editing an expense today silently rewrites every past chart.
 *
 * Closed months are never revised — they record what was true at the time. The
 * month in progress is different: it is not history yet, so it tracks the
 * figures as they stand. Freezing it at whatever was true the first time the
 * dashboard was opened is how the trend ends up showing a surplus from before
 * you had entered your goals.
 */

export function monthKeyOf(date = clockNow()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export interface SnapshotFacts {
  corpus: number;
  net_worth: number;
  surplus: number;
  savings_rate: number;
  total_inflow: number;
  total_outflow: number;
}

/** What the current month looks like right now, before it is written down. */
export function currentFacts(snapshot: Snapshot, now = clockNow()): SnapshotFacts {
  const { input } = toEngineInput(snapshot);
  const first = simulate({ ...input, horizonMonths: 1 }).months[0];

  const corpus = Number(snapshot.profile.liquid_corpus);
  const debt =
    snapshot.loans.reduce((sum, l) => sum + outstandingToday(l, now), 0) +
    snapshot.cards.reduce((sum, c) => sum + Number(c.current_bill), 0);

  const outflow =
    first.fixed +
    first.variable +
    first.loanEmis +
    first.investments +
    first.purchaseEmis +
    first.ringFenced;

  return {
    // Goal balances are buckets inside the corpus, so they are not added again.
    corpus,
    net_worth: corpus - debt,
    surplus: first.surplus,
    savings_rate: first.inflow > 0 ? first.surplus / first.inflow : 0,
    total_inflow: first.inflow,
    total_outflow: outflow,
  };
}

/**
 * What a loan still owes today, amortised from the balance you entered.
 *
 * `loan.outstanding` is the figure typed when the loan was added and it never
 * moves on its own, so a year of EMIs used to raise the corpus while leaving
 * the debt untouched: net worth understated progress every single month. Each
 * payment is split into interest on the balance and principal off it, which is
 * what a lender does.
 */
function outstandingToday(loan: LoanRow, now: Date): number {
  const start = new Date(loan.start_date);
  const monthsPaid =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());

  let balance = Number(loan.outstanding);
  const emi = Number(loan.emi);
  const monthlyRate = Number(loan.annual_rate_pct) / 12 / 100;
  const elapsed = Math.min(Math.max(0, monthsPaid), loan.tenure_months);

  for (let month = 0; month < elapsed && balance > 0; month++) {
    const interest = balance * monthlyRate;
    balance = Math.max(0, balance + interest - emi);
  }
  return balance;
}

export interface EnsureResult {
  written: boolean;
  month: string;
  row: MonthlySnapshotRow | null;
}

/** True when any figure has moved by more than rounding noise. */
function factsDiffer(row: MonthlySnapshotRow, facts: SnapshotFacts): boolean {
  return (
    Math.abs(Number(row.corpus) - facts.corpus) > 1 ||
    Math.abs(Number(row.net_worth) - facts.net_worth) > 1 ||
    Math.abs(Number(row.surplus) - facts.surplus) > 1 ||
    Math.abs(Number(row.total_inflow) - facts.total_inflow) > 1 ||
    Math.abs(Number(row.total_outflow) - facts.total_outflow) > 1
  );
}

/**
 * Keeps this month's snapshot in step with the data: inserts it the first time,
 * and updates it afterwards while the month is still open. Earlier months are
 * never touched. Idempotent and safe to call on every page load — the unique
 * index on `month` is the backstop if two requests race, and an unchanged month
 * writes nothing.
 */
export async function ensureMonthlySnapshot(
  snapshot: Snapshot,
  now = clockNow(),
): Promise<EnsureResult> {
  const month = monthKeyOf(now);
  const existing = snapshot.snapshots.find((s) => s.month.slice(0, 10) === month);
  const facts = currentFacts(snapshot);

  try {
    if (existing) {
      if (!factsDiffer(existing, facts)) {
        return { written: false, month, row: existing };
      }
      const row = await driver().update<MonthlySnapshotRow>(
        'monthly_snapshot',
        existing.id,
        facts,
      );
      return { written: true, month, row };
    }

    const row = await driver().insert<MonthlySnapshotRow>('monthly_snapshot', {
      month,
      ...facts,
    });
    return { written: true, month, row };
  } catch (error) {
    // A concurrent request won the race, or the DB is unreachable. Neither is
    // worth failing a page render over - the next load will try again.
    console.warn('[wishit] monthly snapshot not written:', error);
    return { written: false, month, row: existing ?? null };
  }
}

/** Overwrites this month's snapshot with current facts. Used by "close out". */
export async function rewriteMonthlySnapshot(
  snapshot: Snapshot,
  now = clockNow(),
): Promise<MonthlySnapshotRow> {
  const db = driver();
  const month = monthKeyOf(now);
  const existing = snapshot.snapshots.find((s) => s.month.slice(0, 10) === month);
  const facts = currentFacts(snapshot);

  if (existing) {
    return db.update<MonthlySnapshotRow>('monthly_snapshot', existing.id, facts);
  }
  return db.insert<MonthlySnapshotRow>('monthly_snapshot', { month, ...facts });
}

/** The snapshot immediately before `month`, if there is one. */
export function previousSnapshot(
  snapshots: MonthlySnapshotRow[],
  month: string,
): MonthlySnapshotRow | null {
  const earlier = snapshots
    .filter((s) => s.month.slice(0, 10) < month)
    .sort((a, b) => a.month.localeCompare(b.month));
  return earlier.at(-1) ?? null;
}
