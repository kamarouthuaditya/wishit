import { redirect } from 'next/navigation';
import { loadSnapshot } from '@/lib/db/repository';
import { deleteExpense, saveExpense, seedDefaultExpenses } from '@/lib/actions';
import { onboardingGuard } from '@/lib/onboarding';
import { monthlyBalance } from '@/lib/model/balance';
import { inr, isoDate } from '@/lib/format';
import { RunningBalance, StepFooter, StepHeading } from '@/components/onboarding';
import { Money } from '@/components/ui';
import { SubmitButton, SubmitText } from '@/components/submit-button';
import { IconPlus } from '@/components/icons';

export const dynamic = 'force-dynamic';

/** `2026-09-01` → `Sep 2026`. The day is noise on a recurring line. */
function monthOf(date: string): string {
  return new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

const FREQUENCY: Record<number, string> = {
  1: 'monthly',
  3: 'quarterly',
  6: 'half-yearly',
  12: 'yearly',
};

/**
 * Step 3, optional. What the month costs.
 *
 * Skippable because a bare income and balance still produce a working app, and
 * an eleven-line budget is more than anyone will type before they trust the
 * thing. The typical month is offered as one button for exactly that reason:
 * eleven editable lines in one click beats eleven empty fields.
 *
 * The balance above the list moves with every line, which is the argument for
 * filling it in.
 */
export default async function ExpensesStepPage() {
  const snapshot = await loadSnapshot();
  const elsewhere = onboardingGuard(snapshot.profile, 'expenses');
  if (elsewhere) redirect(elsewhere);

  const balance = monthlyBalance(snapshot);
  const expenses = snapshot.expenses;
  const today = isoDate();

  return (
    <div className="space-y-7">
      <StepHeading
        slug="expenses"
        title="What the month costs"
        blurb="Rent, food, the subscriptions you forgot about. This is what the balance is left over from — until it is in, the app thinks your whole salary is spare."
      />

      <RunningBalance
        balance={balance.balance}
        caveat={
          expenses.length === 0
            ? 'Your whole salary, because nothing has been taken out of it yet.'
            : `After ${expenses.length} ${expenses.length === 1 ? 'line' : 'lines'}. A yearly bill counts in the month it renews, not spread across the year.`
        }
      />

      {expenses.length === 0 && (
        <form action={seedDefaultExpenses}>
          <div className="border border-dashed border-line px-5 py-4">
            <p className="max-w-prose text-[14px] text-ink-soft">
              Start from a typical month — rent, food, petrol, insurance, a SIP —
              then edit the amounts. Faster than a blank list, and every line is
              yours to change or delete.
            </p>
            <SubmitButton
              variant="ghost"
              className="mt-4"
              pendingLabel="Adding a typical month…"
            >
              Use a typical month
            </SubmitButton>
          </div>
        </form>
      )}

      <form action={saveExpense} className="space-y-2">
        <div className="flex flex-wrap items-stretch gap-px border border-line bg-line">
          <input
            name="name"
            required
            placeholder="Rent, Gym, Netflix…"
            aria-label="What it is"
            className="min-w-[9rem] flex-[1.4] bg-paper px-3 py-3 text-[15px] outline-none placeholder:text-ink-faint"
          />

          <div className="flex min-w-[7rem] flex-1 items-center gap-2 bg-paper px-3">
            <span aria-hidden className="text-[15px] text-ink-faint">
              ₹
            </span>
            <input
              name="amount"
              type="number"
              step="1"
              inputMode="numeric"
              required
              placeholder="0"
              aria-label="Amount per bill"
              className="tnum w-full bg-transparent py-3 text-[16px] font-medium outline-none placeholder:text-ink-faint"
            />
          </div>

          <select
            name="frequency_months"
            defaultValue="1"
            aria-label="How often"
            className="min-w-[7rem] bg-paper px-3 py-3 text-[14px] text-ink-soft outline-none"
          >
            {Object.entries(FREQUENCY).map(([months, label]) => (
              <option key={months} value={months}>
                {label}
              </option>
            ))}
          </select>

          <select
            name="type"
            defaultValue="fixed"
            aria-label="Kind"
            className="min-w-[7rem] bg-paper px-3 py-3 text-[14px] text-ink-soft outline-none"
          >
            <option value="fixed">fixed</option>
            <option value="variable">varies</option>
            <option value="investment">investment</option>
          </select>

          {/*
            Both dates are here rather than only on the expenses page. The row
            used to be stamped with today whether or not that was true, which is
            wrong for the rent that starts next month and for the loan-adjacent
            bill that stops in March — and it was stamped invisibly, so there
            was nothing to correct. Blank `from` still means today, and blank
            `until` still means forever; the fields say so instead of assuming.
          */}
          <label className="flex min-w-[10rem] flex-1 items-center gap-2 bg-paper px-3 text-[13px] text-ink-faint">
            from
            <input
              name="effective_from"
              type="date"
              defaultValue={today}
              aria-label="First month it is charged"
              className="tnum w-full bg-transparent py-3 text-[14px] text-ink outline-none"
            />
          </label>

          <label className="flex min-w-[10rem] flex-1 items-center gap-2 bg-paper px-3 text-[13px] text-ink-faint">
            until
            <input
              name="effective_to"
              type="date"
              aria-label="Last month it is charged — blank means it keeps running"
              className="tnum w-full bg-transparent py-3 text-[14px] text-ink outline-none"
            />
          </label>

          <SubmitButton
            className="px-5 py-3 text-[13px]"
            pendingLabel="Adding…"
          >
            <IconPlus size={15} />
            Add
          </SubmitButton>
        </div>
        <p className="text-[12px] text-ink-faint">
          Fixed is the same every month; varies is a budget you spend against.
          Leave <em className="not-italic text-ink-soft">until</em> blank for
          anything that keeps running. Categories and cards wait on the expenses
          page.
        </p>
      </form>

      {expenses.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {expenses.map((expense) => (
            <li
              key={expense.id}
              className="flex items-baseline justify-between gap-4 py-2.5"
            >
              <span className="min-w-0 text-[14px]">
                <span className="truncate">{expense.name}</span>
                <span className="ml-2 text-[11px] uppercase tracking-[0.06em] text-ink-faint">
                  {expense.type === 'variable' ? 'varies' : expense.type}
                  {expense.frequency_months !== 1 &&
                    ` · ${FREQUENCY[expense.frequency_months] ?? 'monthly'}`}
                  {/*
                    Dates only when they say something. A line that starts today
                    and never ends is the ordinary case, and printing "from Jul
                    2026" on every row would bury the two that are different.
                  */}
                  {expense.effective_from > today &&
                    ` · from ${monthOf(expense.effective_from)}`}
                  {expense.effective_to && ` · until ${monthOf(expense.effective_to)}`}
                </span>
              </span>
              <span className="flex shrink-0 items-baseline gap-4">
                <Money amount={Number(expense.amount)} />
                <form action={deleteExpense}>
                  <input type="hidden" name="id" value={expense.id} />
                  <SubmitText pendingLabel="Removing…">Remove</SubmitText>
                </form>
              </span>
            </li>
          ))}
        </ul>
      )}

      <StepFooter
        from="expenses"
        label={expenses.length > 0 ? 'Continue' : 'Skip for now'}
        note={
          expenses.length > 0
            ? `${inr(balance.expenses)} a month, counted.`
            : 'You can add these any time from the expenses page.'
        }
      />
    </div>
  );
}
