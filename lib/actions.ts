'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { driver } from '@/lib/db/driver';
import { getProfile, loadSnapshot } from '@/lib/db/repository';
import { rewriteMonthlySnapshot } from '@/lib/snapshot';
import { planTransfer, type TransferParty } from '@/lib/model/transfer';
import { supabaseServer } from '@/lib/supabase/server';
import {
  ONBOARDING_STEPS,
  advancedStep,
  resumePath,
  stepIndex,
  stepPath,
} from '@/lib/onboarding';
import { inr, isoDate, num, optionalNum, optionalStr, str } from '@/lib/format';
import type {
  CreditCardRow,
  ExpenseItemRow,
  GoalRow,
  IncomeRow,
  LoanRow,
  ProfileRow,
  TransactionRow,
  WishlistItemRow,
} from '@/lib/db/types';

function refresh() {
  revalidatePath('/', 'layout');
}

// ------------------------------------------------------------------ setup ---

/**
 * First run, one step at a time. See lib/onboarding.ts for why it is a sequence
 * and not the single form it used to be.
 *
 * Every step writes the same rows the rest of the app writes — there is no
 * parallel "onboarding draft" anywhere — so abandoning half way leaves real,
 * editable data rather than a discarded wizard state. The only extra thing
 * recorded is how far the sequence got.
 */

/** Step 1. Nothing in the app means anything without this. */
export async function saveOnboardingIncome(formData: FormData): Promise<void> {
  const db = driver();
  const profile = await getProfile();
  const today = isoDate();

  const salary = num(formData.get('net_salary'));
  // Zero salary is not a state the app can say anything useful from, and the
  // browser's `required` is a courtesy, not a guarantee.
  if (salary <= 0) redirect(`${stepPath(0)}?error=salary`);

  const previous = await db.list<IncomeRow>('income');
  const previousSalary = previous.find((i) => i.type === 'salary');
  const previousBonus = previous.find((i) => i.type === 'bonus');

  await db.update<ProfileRow>('profile', profile.id, {
    name: str(formData.get('name'), 'Me'),
    pay_date: num(formData.get('pay_date'), 1),
    bonus_mode: formData.get('bonus_mode') === 'amortised' ? 'amortised' : 'lump',
    onboarding_step: advancedStep(profile, 'income'),
  });

  const income: Partial<IncomeRow>[] = [
    {
      type: 'salary',
      label: 'Net salary',
      amount: salary,
      frequency: 'monthly',
      effective_from: previousSalary?.effective_from ?? today,
    },
  ];
  const bonus = num(formData.get('bonus_amount'));
  if (bonus > 0) {
    income.push({
      type: 'bonus',
      label: 'Annual bonus',
      amount: bonus,
      frequency: 'annual',
      bonus_month: num(formData.get('bonus_month'), 4),
      effective_from: previousBonus?.effective_from ?? today,
    });
  }
  await db.replaceAll<IncomeRow>('income', income);

  refresh();
  redirect(stepPath(1));
}

/** Step 2. What you have today, and the line you will not cross. */
export async function saveOnboardingBalances(formData: FormData): Promise<void> {
  const db = driver();
  const profile = await getProfile();

  const corpus = num(formData.get('liquid_corpus'), -1);
  // −1 is "the field came back empty", which is different from an honest zero:
  // someone with nothing saved should be able to say so and carry on.
  if (corpus < 0) redirect(`${stepPath(1)}?error=savings`);

  await db.update<ProfileRow>('profile', profile.id, {
    liquid_corpus: corpus,
    emergency_floor: Math.max(0, num(formData.get('emergency_floor'))),
    onboarding_step: advancedStep(profile, 'balances'),
  });

  refresh();
  redirect(stepPath(2));
}

/**
 * The Continue and Skip buttons on the optional steps. Both do the same thing —
 * the difference is only whether anything was added first — so both go through
 * here rather than one being a link that quietly leaves the counter behind.
 */
export async function advanceOnboarding(formData: FormData): Promise<void> {
  const profile = await getProfile();
  const from = str(formData.get('from'), '');
  const index = stepIndex(from);
  if (index === -1) redirect(resumePath(profile));

  await driver().update<ProfileRow>('profile', profile.id, {
    onboarding_step: advancedStep(profile, from),
  });

  refresh();
  redirect(stepPath(index + 1));
}

/** The last step. From here on the app is the app. */
export async function finishOnboarding(): Promise<void> {
  const profile = await getProfile();
  await driver().update<ProfileRow>('profile', profile.id, {
    setup_complete: true,
    onboarding_step: ONBOARDING_STEPS.length,
  });

  refresh();
  redirect('/');
}

export interface SetupResult {
  /** One line per field that actually moved, already worded for a human. */
  changes: string[];
  /** Stamped per save so the page can tell two saves apart. */
  at: number;
}

const BONUS_MODES: Record<string, string> = {
  lump: 'lump sum in the month it arrives',
  amortised: 'spread across 12 months',
};

const ALLOCATION_MODES: Record<string, string> = {
  waterfall: 'priority order',
  fixed: 'fixed amount into each goal',
  proportional: 'split proportionally',
};

/**
 * Module 0. One-time wizard, re-editable at any time.
 *
 * Reports what moved rather than just succeeding silently: these are the
 * numbers every projection is built on, and changing your salary by a digit
 * should not look identical to changing nothing.
 */
export async function saveSetup(
  _previous: SetupResult | null,
  formData: FormData,
): Promise<SetupResult> {
  const db = driver();
  const profile = await getProfile();
  const today = isoDate();

  const before = await db.list<IncomeRow>('income');
  const previousSalary = before.find((i) => i.type === 'salary');
  const previousBonus = before.find((i) => i.type === 'bonus');

  const changes: string[] = [];
  const note = (
    label: string,
    from: string | number | null | undefined,
    to: string | number,
    format: (value: string | number) => string = String,
  ) => {
    const wasEmpty = from == null || from === '';
    if (!wasEmpty && String(from) === String(to)) return;
    changes.push(
      wasEmpty
        ? `${label} set to ${format(to)}`
        : `${label}: ${format(from)} → ${format(to)}`,
    );
  };

  const nextName = str(formData.get('name'), 'Me');
  const nextPayDate = num(formData.get('pay_date'), 1);
  const nextSalary = num(formData.get('net_salary'));
  const nextBonus = num(formData.get('bonus_amount'));
  const nextBonusMonth = num(formData.get('bonus_month'), 1);
  const nextBonusMode =
    formData.get('bonus_mode') === 'amortised' ? 'amortised' : 'lump';
  const nextCorpus = num(formData.get('liquid_corpus'));
  const nextFloor = num(formData.get('emergency_floor'));
  const nextReturn = num(formData.get('annual_return_pct'));
  const nextInflation = num(formData.get('annual_inflation_pct'));
  const nextAllocation = str(
    formData.get('allocation_mode'),
    'waterfall',
  ) as ProfileRow['allocation_mode'];
  const nextHorizon = num(formData.get('horizon_months'), 36);

  note('Name', profile.name, nextName);
  note('Pay date', profile.pay_date, nextPayDate, (v) => `the ${v}th`);
  note('Net salary', previousSalary ? Number(previousSalary.amount) : null,
    nextSalary, (v) => inr(Number(v)));
  note('Annual bonus', previousBonus ? Number(previousBonus.amount) : 0,
    nextBonus, (v) => inr(Number(v)));
  if (nextBonus > 0) {
    note('Bonus due in', previousBonus?.bonus_month ?? null, nextBonusMonth,
      (v) => `${v} months`);
  }
  note('Bonus counted as', profile.bonus_mode, nextBonusMode,
    (v) => BONUS_MODES[String(v)] ?? String(v));
  note('Available savings', Number(profile.liquid_corpus), nextCorpus,
    (v) => inr(Number(v)));
  note('Emergency floor', Number(profile.emergency_floor), nextFloor,
    (v) => inr(Number(v)));
  note('Expected return', Number(profile.annual_return_pct), nextReturn,
    (v) => `${v}%`);
  note('Inflation', Number(profile.annual_inflation_pct), nextInflation,
    (v) => `${v}%`);
  note('Goal allocation', profile.allocation_mode, nextAllocation,
    (v) => ALLOCATION_MODES[String(v)] ?? String(v));
  note('Projection horizon', profile.horizon_months, nextHorizon,
    (v) => `${v} months`);

  await db.update<ProfileRow>('profile', profile.id, {
    name: nextName,
    pay_date: nextPayDate,
    liquid_corpus: nextCorpus,
    emergency_floor: nextFloor,
    annual_return_pct: nextReturn,
    annual_inflation_pct: nextInflation,
    bonus_mode: nextBonusMode,
    allocation_mode: nextAllocation,
    horizon_months: nextHorizon,
    setup_complete: true,
    // Saving Settings by hand is a stronger statement than finishing the
    // sequence, so it closes the sequence too.
    onboarding_step: ONBOARDING_STEPS.length,
  });

  // Income is rewritten wholesale - it is two or three rows, never a list.
  const income: Partial<IncomeRow>[] = [
    {
      type: 'salary',
      label: 'Net salary',
      amount: nextSalary,
      frequency: 'monthly',
      effective_from: previousSalary?.effective_from ?? today,
    },
  ];
  if (nextBonus > 0) {
    income.push({
      type: 'bonus',
      label: 'Annual bonus',
      amount: nextBonus,
      frequency: 'annual',
      bonus_month: nextBonusMonth,
      effective_from: previousBonus?.effective_from ?? today,
    });
  }
  await db.replaceAll<IncomeRow>('income', income);

  refresh();
  return { changes, at: Date.now() };
}

/**
 * Sets the display name from the account page. Written in two places on
 * purpose: the profile row is what the app reads, and the auth metadata is what
 * survives if the profile is ever rebuilt.
 */
export async function saveProfileName(formData: FormData): Promise<void> {
  const first = str(formData.get('first_name'), '').trim();
  const last = str(formData.get('last_name'), '').trim();
  const name = [first, last].filter(Boolean).join(' ') || 'Me';

  const profile = await getProfile();
  await driver().update<ProfileRow>('profile', profile.id, { name });

  try {
    const supabase = await supabaseServer();
    await supabase.auth.updateUser({
      data: { first_name: first, last_name: last },
    });
  } catch {
    // Local JSON mode has no auth. The profile row is the source of truth.
  }

  refresh();
}

/** Quick edit of a single profile field set, without the wizard redirect. */
export async function updateProfile(formData: FormData): Promise<void> {
  const db = driver();
  const profile = await getProfile();
  const patch: Partial<ProfileRow> = {};

  if (formData.has('liquid_corpus'))
    patch.liquid_corpus = num(formData.get('liquid_corpus'));
  if (formData.has('emergency_floor'))
    patch.emergency_floor = num(formData.get('emergency_floor'));
  if (formData.has('bonus_mode'))
    patch.bonus_mode = formData.get('bonus_mode') === 'amortised' ? 'amortised' : 'lump';
  if (formData.has('allocation_mode'))
    patch.allocation_mode = str(
      formData.get('allocation_mode'),
      'waterfall',
    ) as ProfileRow['allocation_mode'];
  if (formData.has('annual_return_pct'))
    patch.annual_return_pct = num(formData.get('annual_return_pct'));
  if (formData.has('annual_inflation_pct'))
    patch.annual_inflation_pct = num(formData.get('annual_inflation_pct'));
  if (formData.has('horizon_months'))
    patch.horizon_months = num(formData.get('horizon_months'), 36);

  await db.update<ProfileRow>('profile', profile.id, patch);
  refresh();
}

// --------------------------------------------------------------- expenses ---

export async function saveExpense(formData: FormData): Promise<void> {
  const db = driver();
  const id = optionalStr(formData.get('id'));
  const frequency = num(formData.get('frequency_months'), 1);
  const row: Partial<ExpenseItemRow> = {
    name: str(formData.get('name'), 'Untitled'),
    category: str(formData.get('category'), 'general'),
    amount: num(formData.get('amount')),
    type: str(formData.get('type'), 'fixed') as ExpenseItemRow['type'],
    is_budget: formData.get('type') === 'variable',
    frequency_months: [1, 3, 6, 12].includes(frequency) ? frequency : 1,
    paid_by_card_id: optionalStr(formData.get('paid_by_card_id')),
    effective_from: str(formData.get('effective_from'), isoDate()),
    effective_to: optionalStr(formData.get('effective_to')),
    is_active: true,
  };

  if (id) await db.update<ExpenseItemRow>('expense_item', id, row);
  else await db.insert<ExpenseItemRow>('expense_item', row);
  refresh();
}

/**
 * Pre-fills a typical Indian monthly budget so the app is usable in three
 * minutes. Every line is editable and deletable afterwards.
 */
export async function seedDefaultExpenses(): Promise<void> {
  const db = driver();
  const today = isoDate();
  const defaults: [string, string, number, ExpenseItemRow['type']][] = [
    ['Rent', 'housing', 25_000, 'fixed'],
    ['Home contribution', 'family', 15_000, 'fixed'],
    ['Insurance', 'insurance', 2_000, 'fixed'],
    ['Internet', 'utilities', 1_000, 'fixed'],
    ['Subscriptions', 'utilities', 1_500, 'fixed'],
    ['Food', 'food', 8_000, 'variable'],
    ['Petrol', 'transport', 4_000, 'variable'],
    ['Travel', 'transport', 3_000, 'variable'],
    ['Shopping', 'lifestyle', 4_000, 'variable'],
    ['Medical', 'health', 1_000, 'variable'],
    ['SIP', 'investment', 20_000, 'investment'],
  ];

  for (const [name, category, amount, type] of defaults) {
    await db.insert<ExpenseItemRow>('expense_item', {
      name,
      category,
      amount,
      type,
      is_budget: type === 'variable',
      frequency_months: 1,
      paid_by_card_id: null,
      effective_from: today,
      effective_to: null,
      is_active: true,
    });
  }
  refresh();
}

export async function deleteExpense(formData: FormData): Promise<void> {
  const id = optionalStr(formData.get('id'));
  if (id) await driver().remove('expense_item', id);
  refresh();
}

// ----------------------------------------------------------- credit cards ---

export async function saveCard(formData: FormData): Promise<void> {
  const db = driver();
  const id = optionalStr(formData.get('id'));
  const row: Partial<CreditCardRow> = {
    name: str(formData.get('name'), 'Card'),
    credit_limit: num(formData.get('credit_limit')),
    statement_day: num(formData.get('statement_day'), 1),
    due_day: num(formData.get('due_day'), 20),
    current_bill: num(formData.get('current_bill')),
  };

  if (id) await db.update<CreditCardRow>('credit_card', id, row);
  else await db.insert<CreditCardRow>('credit_card', row);
  refresh();
}

export async function deleteCard(formData: FormData): Promise<void> {
  const id = optionalStr(formData.get('id'));
  if (id) await driver().remove('credit_card', id);
  refresh();
}

// ------------------------------------------------------------------ loans ---

export async function saveLoan(formData: FormData): Promise<void> {
  const db = driver();
  const id = optionalStr(formData.get('id'));
  const principal = num(formData.get('principal'));
  const row: Partial<LoanRow> = {
    name: str(formData.get('name'), 'Loan'),
    type: str(formData.get('type'), 'other') as LoanRow['type'],
    principal,
    outstanding: num(formData.get('outstanding'), principal),
    annual_rate_pct: num(formData.get('annual_rate_pct')),
    emi: num(formData.get('emi')),
    tenure_months: num(formData.get('tenure_months')),
    start_date: str(formData.get('start_date'), isoDate()),
    due_day: num(formData.get('due_day'), 1),
    is_no_cost: formData.get('is_no_cost') === 'on',
    cash_discount: num(formData.get('cash_discount')),
    processing_fee: num(formData.get('processing_fee')),
    notional_rate_pct: num(formData.get('notional_rate_pct'), 15),
  };

  if (id) await db.update<LoanRow>('loan', id, row);
  else await db.insert<LoanRow>('loan', row);
  refresh();
}

/**
 * The four-field version, for the onboarding step: what it is called, the EMI,
 * how many are left, and when it leaves.
 *
 * Outstanding falls back to EMI × months remaining. It is the wrong number —
 * it counts interest not yet accrued as debt — but it is close, it is stated,
 * and it is far better than the zero a blank field would leave sitting in your
 * net worth. The loans page asks for the real figure.
 */
export async function saveOnboardingLoan(formData: FormData): Promise<void> {
  const emi = num(formData.get('emi'));
  const tenure = num(formData.get('tenure_months'));
  if (emi <= 0 || tenure <= 0) return;

  const outstanding = num(formData.get('outstanding'), 0) || emi * tenure;

  await driver().insert<LoanRow>('loan', {
    name: str(formData.get('name'), 'Loan'),
    type: str(formData.get('type'), 'other') as LoanRow['type'],
    principal: outstanding,
    outstanding,
    annual_rate_pct: num(formData.get('annual_rate_pct')),
    emi,
    tenure_months: tenure,
    start_date: isoDate(),
    due_day: num(formData.get('due_day'), 5),
    is_no_cost: false,
    cash_discount: 0,
    processing_fee: 0,
    notional_rate_pct: 15,
  });
  refresh();
}

export async function deleteLoan(formData: FormData): Promise<void> {
  const id = optionalStr(formData.get('id'));
  if (id) await driver().remove('loan', id);
  refresh();
}

// ------------------------------------------------------------------ goals ---

export async function saveGoal(formData: FormData): Promise<void> {
  const db = driver();
  const id = optionalStr(formData.get('id'));
  const row: Partial<GoalRow> = {
    name: str(formData.get('name'), 'Goal'),
    target: num(formData.get('target')),
    current_amount: num(formData.get('current_amount')),
    deadline: optionalStr(formData.get('deadline')),
    contribute_until: optionalStr(formData.get('contribute_until')),
    stop_at_deadline: formData.get('stop_at_deadline') === 'on',
    priority: num(formData.get('priority'), 1),
    expected_return_pct: num(formData.get('expected_return_pct')),
    is_protected: formData.get('is_protected') === 'on',
    fixed_contribution: optionalNum(formData.get('fixed_contribution')),
    weight: num(formData.get('weight'), 1),
  };

  if (id) await db.update<GoalRow>('goal', id, row);
  else await db.insert<GoalRow>('goal', row);
  refresh();
}

/**
 * Sets just the planned monthly contribution, without touching the rest of the
 * goal. Used from the goals page, where goals sit alongside SIPs and FDs so the
 * whole monthly allocation can be balanced in one place.
 */
export async function setGoalContribution(formData: FormData): Promise<void> {
  const id = optionalStr(formData.get('id'));
  if (!id) return;
  await driver().update<GoalRow>('goal', id, {
    fixed_contribution: optionalNum(formData.get('fixed_contribution')),
  });
  refresh();
}

/**
 * Moves money already saved from one goal to another — the laptop paid for out
 * of what the emergency fund has built up. Both balances are buckets inside the
 * same corpus, so nothing else moves.
 */
export async function transferBetweenGoals(formData: FormData): Promise<void> {
  const fromId = optionalStr(formData.get('from_id'));
  const toId = optionalStr(formData.get('to_id'));
  const requested = optionalNum(formData.get('amount'));
  if (!fromId || !toId || requested == null) return;

  const db = driver();
  const goals = await db.list<GoalRow>('goal');
  const from = goals.find((g) => g.id === fromId);
  const to = goals.find((g) => g.id === toId);
  if (!from || !to) return;

  const plan = planTransfer(toParty(from), toParty(to), requested);
  if (plan.blocked || plan.amount <= 0) return;

  await db.update<GoalRow>('goal', from.id, { current_amount: plan.fromAfter });
  await db.update<GoalRow>('goal', to.id, { current_amount: plan.toAfter });
  refresh();
}

function toParty(goal: GoalRow): TransferParty {
  return {
    id: goal.id,
    name: goal.name,
    balance: Number(goal.current_amount),
    target: Number(goal.target),
    isProtected: goal.is_protected,
  };
}

/**
 * Marks a goal finished, or puts it back in service. Deliberately not a delete:
 * the balance stays where it is, it simply stops being fed and stops competing
 * for the surplus.
 */
export async function setGoalStatus(formData: FormData): Promise<void> {
  const id = optionalStr(formData.get('id'));
  if (!id) return;
  const status: GoalRow['status'] =
    formData.get('status') === 'done' ? 'done' : 'active';
  await driver().update<GoalRow>('goal', id, { status });
  refresh();
}

export async function deleteGoal(formData: FormData): Promise<void> {
  const id = optionalStr(formData.get('id'));
  if (id) await driver().remove('goal', id);
  refresh();
}

// --------------------------------------------------------------- wishlist ---

export async function saveWishlistItem(formData: FormData): Promise<void> {
  const db = driver();
  const id = optionalStr(formData.get('id'));
  const mode = str(formData.get('purchase_mode'), 'cash') as
    WishlistItemRow['purchase_mode'];
  const price = num(formData.get('price'));
  const isNoCost = formData.get('is_no_cost') === 'on';

  const row: Partial<WishlistItemRow> = {
    name: str(formData.get('name'), 'Item'),
    category: str(formData.get('category'), 'general'),
    price,
    priority: num(formData.get('priority'), 3),
    target_date: optionalStr(formData.get('target_date')),
    reason: optionalStr(formData.get('reason')),
    purchase_mode: mode,
    emi_amount: optionalNum(formData.get('emi_amount')),
    emi_tenure: optionalNum(formData.get('emi_tenure')),
    down_payment: optionalNum(formData.get('down_payment')),
    monthly_saving: optionalNum(formData.get('monthly_saving')),
    annual_rate_pct: isNoCost ? 0 : num(formData.get('annual_rate_pct')),
    is_no_cost: isNoCost,
    status: str(formData.get('status'), 'idea') as WishlistItemRow['status'],
    purchase_month: optionalNum(formData.get('purchase_month')),
  };

  if (id) await db.update<WishlistItemRow>('wishlist_item', id, row);
  else await db.insert<WishlistItemRow>('wishlist_item', row);
  refresh();
}

/*
 * `setWishlistStatus` used to live here, writing the one field from a select at
 * the top of an item's panel. The panel also carried the full form, which has a
 * Status field of its own, so an open item showed two controls for one value
 * and two Saves that meant different things. The full form is the survivor.
 */

export async function deleteWishlistItem(formData: FormData): Promise<void> {
  const id = optionalStr(formData.get('id'));
  if (id) await driver().remove('wishlist_item', id);
  refresh();
}

// ----------------------------------------------------------- transactions ---

export async function addTransaction(formData: FormData): Promise<void> {
  await driver().insert<TransactionRow>('transaction', {
    date: str(formData.get('date'), isoDate()),
    amount: num(formData.get('amount')),
    category: str(formData.get('category'), 'general'),
    note: optionalStr(formData.get('note')),
    source: 'manual',
    // One-offs are excluded from the run-rate so a single medical bill does not
    // get extrapolated across twelve months.
    is_one_off: formData.get('is_one_off') === 'on',
    // Tagging the card is what makes its bill real: the money is the same, it
    // just leaves on the due date instead of today.
    paid_by_card_id: optionalStr(formData.get('paid_by_card_id')),
  });
  refresh();
}

/**
 * Edits a logged spend. Deleting and re-adding was the only correction path,
 * which is three steps for a typo in an amount.
 */
export async function updateTransaction(formData: FormData): Promise<void> {
  const id = optionalStr(formData.get('id'));
  if (!id) return;

  await driver().update<TransactionRow>('transaction', id, {
    date: str(formData.get('date'), isoDate()),
    amount: num(formData.get('amount')),
    category: str(formData.get('category'), 'general'),
    note: optionalStr(formData.get('note')),
    is_one_off: formData.get('is_one_off') === 'on',
    paid_by_card_id: optionalStr(formData.get('paid_by_card_id')),
  });
  refresh();
}

export async function deleteTransaction(formData: FormData): Promise<void> {
  const id = optionalStr(formData.get('id'));
  if (id) await driver().remove('transaction', id);
  refresh();
}

// ---------------------------------------------------------------- review ----

/**
 * Closes the month out: records corpus, net worth and surplus as they stand.
 * Trends read these rows and never recompute them.
 */
export async function closeOutMonth(): Promise<void> {
  const snapshot = await loadSnapshot();
  await rewriteMonthlySnapshot(snapshot);
  refresh();
}

/** "Anything change in income or fixed costs?" — the answer, applied. */
export async function applyMonthlyCorrections(formData: FormData): Promise<void> {
  const db = driver();
  const profile = await getProfile();

  const corpus = optionalNum(formData.get('liquid_corpus'));
  if (corpus != null) {
    await db.update<ProfileRow>('profile', profile.id, { liquid_corpus: corpus });
  }

  const salaryId = optionalStr(formData.get('salary_id'));
  const salary = optionalNum(formData.get('net_salary'));
  if (salaryId && salary != null) {
    await db.update<IncomeRow>('income', salaryId, { amount: salary });
  }

  // Goal balances drift in real life; the review is where they get corrected.
  for (const [key, value] of formData.entries()) {
    const match = key.match(/^goal_current_(.+)$/);
    if (!match) continue;
    const amount = optionalNum(value);
    if (amount == null) continue;
    await db.update<GoalRow>('goal', match[1], { current_amount: amount });
  }

  refresh();
}
