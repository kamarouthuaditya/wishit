import 'server-only';
import { redirect } from 'next/navigation';
import { resumePath } from '@/lib/onboarding';
import { driver } from './driver';
import type {
  CreditCardRow,
  ExpenseItemRow,
  GoalRow,
  IncomeRow,
  LoanRow,
  MonthlySnapshotRow,
  ProfileRow,
  ScenarioRow,
  Snapshot,
  TransactionRow,
  WishlistItemRow,
} from './types';

export const DEFAULT_PROFILE: Omit<ProfileRow, 'id'> = {
  name: 'Me',
  currency: 'INR',
  fiscal_month_start: 1,
  pay_date: 1,
  liquid_corpus: 0,
  emergency_floor: 0,
  annual_return_pct: 0,
  annual_inflation_pct: 0,
  bonus_mode: 'lump',
  allocation_mode: 'waterfall',
  horizon_months: 36,
  setup_complete: false,
  onboarding_step: 0,
};

/**
 * Which row wins when there is more than one.
 *
 * `select *` has no order, and Postgres rewrites an updated row to the end of
 * the heap — so with two profile rows, writing to the one a query returned
 * first is enough to make the *next* query return the other one. That is how
 * onboarding ended up bouncing: each step saved its progress to a row the next
 * page did not read. Oldest first, id as the tiebreak: arbitrary, but the same
 * arbitrary answer every time, which is the whole requirement.
 */
function pickProfile(rows: ProfileRow[]): ProfileRow {
  const born = (row: ProfileRow) =>
    String((row as ProfileRow & { created_at?: string }).created_at ?? '');
  return [...rows].sort(
    (a, b) => born(a).localeCompare(born(b)) || String(a.id).localeCompare(String(b.id)),
  )[0];
}

/**
 * Reads the profile, creating the single row on first run.
 *
 * The re-read after inserting is not paranoia: the root layout and the page
 * both load the snapshot for the same request, in parallel, so on a brand new
 * account both can find zero rows and both insert one. The loser of that race
 * has to end up reading the same row as the winner, or the account spends the
 * rest of its life with two profiles. Migration 0009 stops it happening at all;
 * this stops it mattering on a database that has not run it yet.
 */
export async function getProfile(): Promise<ProfileRow> {
  const db = driver();
  const rows = await db.list<ProfileRow>('profile');
  if (rows.length > 0) return pickProfile(rows);

  const created = await db.insert<ProfileRow>('profile', DEFAULT_PROFILE);
  const after = await db.list<ProfileRow>('profile');
  return after.length > 0 ? pickProfile(after) : created;
}

/** One read, everything the engine and the UI need. */
export async function loadSnapshot(): Promise<Snapshot> {
  const db = driver();
  const [profile, income, expenses, loans, goals, wishlist, cards, scenarios, snapshots] =
    await Promise.all([
      getProfile(),
      db.list<IncomeRow>('income'),
      db.list<ExpenseItemRow>('expense_item'),
      db.list<LoanRow>('loan'),
      db.list<GoalRow>('goal'),
      db.list<WishlistItemRow>('wishlist_item'),
      db.list<CreditCardRow>('credit_card'),
      db.list<ScenarioRow>('scenario'),
      db.list<MonthlySnapshotRow>('monthly_snapshot'),
    ]);

  return {
    profile,
    income,
    expenses: expenses.filter((e) => e.is_active),
    loans,
    goals: [...goals].sort((a, b) => a.priority - b.priority),
    wishlist,
    cards,
    scenarios,
    snapshots: [...snapshots].sort((a, b) => a.month.localeCompare(b.month)),
  };
}

/**
 * The same read, for pages that only make sense once setup is done.
 *
 * A half-configured app does not fail loudly — it renders zeroes, dashes and
 * empty states that look like a broken product rather than an unfinished one.
 * Anyone who lands on one of those pages mid-sequence goes back to where the
 * sequence stopped. `/account` deliberately does not use this: signing out has
 * to stay reachable from every screen.
 */
export async function loadReadySnapshot(): Promise<Snapshot> {
  const snapshot = await loadSnapshot();
  if (!snapshot.profile.setup_complete) redirect(resumePath(snapshot.profile));
  return snapshot;
}

/** Transactions inside a calendar month, `month` being any date in it. */
export async function loadTransactionsForMonth(
  month: string,
): Promise<TransactionRow[]> {
  const rows = await driver().list<TransactionRow>('transaction');
  const prefix = month.slice(0, 7);
  return rows
    .filter((r) => r.date.slice(0, 7) === prefix)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Every month that has at least one transaction, newest first. */
export async function loadTransactionMonths(): Promise<string[]> {
  const rows = await driver().list<TransactionRow>('transaction');
  return [...new Set(rows.map((r) => r.date.slice(0, 7)))].sort((a, b) =>
    b.localeCompare(a),
  );
}
