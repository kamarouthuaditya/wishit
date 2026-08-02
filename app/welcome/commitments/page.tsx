import { redirect } from 'next/navigation';
import { loadSnapshot } from '@/lib/db/repository';
import { deleteLoan, saveOnboardingLoan } from '@/lib/actions';
import { onboardingGuard } from '@/lib/onboarding';
import { monthlyBalance } from '@/lib/model/balance';
import { inr } from '@/lib/format';
import { RunningBalance, StepFooter, StepHeading } from '@/components/onboarding';
import { Money } from '@/components/ui';
import { SubmitButton, SubmitText } from '@/components/submit-button';
import { IconPlus } from '@/components/icons';

export const dynamic = 'force-dynamic';

/**
 * Step 4, optional. The money that leaves whether or not you decide anything.
 *
 * Separate from expenses because an EMI ends: an app that folds a car loan into
 * "expenses" tells you your month costs the same in year four as year one, and
 * it does not. Four fields, because the rest — rate, principal, the exact
 * outstanding — can be estimated well enough to be useful and corrected later.
 */
export default async function CommitmentsStepPage() {
  const snapshot = await loadSnapshot();
  const elsewhere = onboardingGuard(snapshot.profile, 'commitments');
  if (elsewhere) redirect(elsewhere);

  const balance = monthlyBalance(snapshot);
  const loans = snapshot.loans;

  return (
    <div className="space-y-7">
      <StepHeading
        slug="commitments"
        title="What you owe"
        blurb="Loans and EMIs — the money that leaves on a date you did not choose. Kept apart from expenses because these end, and the app should know which month that is."
      />

      <RunningBalance
        balance={balance.balance}
        caveat={
          loans.length === 0
            ? 'Nothing owed, as far as the app knows.'
            : `${inr(balance.loanEmis)} a month of EMIs, on top of what the month costs.`
        }
      />

      <form action={saveOnboardingLoan} className="space-y-2">
        <div className="flex flex-wrap items-stretch gap-px overflow-hidden rounded-xl border border-line bg-line">
          <input
            name="name"
            required
            placeholder="Car loan, phone EMI…"
            aria-label="What it is"
            className="min-w-[9rem] flex-[1.4] bg-paper px-3 py-3 text-[16px] outline-none placeholder:text-ink-faint"
          />

          <div className="flex min-w-[7rem] flex-1 items-center gap-2 bg-paper px-3">
            <span aria-hidden className="text-[16px] text-ink-faint">
              ₹
            </span>
            <input
              name="emi"
              type="number"
              step="1"
              inputMode="numeric"
              required
              placeholder="EMI"
              aria-label="Monthly EMI"
              className="tnum w-full bg-transparent py-3 text-[17px] font-medium outline-none placeholder:text-ink-faint"
            />
          </div>

          <label className="flex min-w-[8rem] items-center gap-2 bg-paper px-3 text-[14px] text-ink-faint">
            <input
              name="tenure_months"
              type="number"
              min={1}
              inputMode="numeric"
              required
              placeholder="24"
              aria-label="EMIs remaining"
              className="tnum w-12 bg-transparent py-3 text-[16px] text-ink outline-none placeholder:text-ink-faint"
            />
            left
          </label>

          <label className="flex min-w-[8rem] items-center gap-2 bg-paper px-3 text-[14px] text-ink-faint">
            due
            <input
              name="due_day"
              type="number"
              min={1}
              max={31}
              defaultValue={5}
              aria-label="Day of the month it is due"
              className="tnum w-12 bg-transparent py-3 text-[16px] text-ink outline-none"
            />
          </label>

          <SubmitButton
            className="px-5 py-3 text-[14px]"
            pendingLabel="Adding…"
          >
            <IconPlus size={15} />
            Add
          </SubmitButton>
        </div>
        <p className="text-[13px] text-ink-faint">
          Outstanding is estimated as EMI × months left until you set the real
          figure on the loans page. Credit cards are not loans and live on their
          own page — a bill is money already spent, not a commitment.
        </p>
      </form>

      {loans.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {loans.map((loan) => (
            <li
              key={loan.id}
              className="flex items-baseline justify-between gap-4 px-4 py-2.5"
            >
              <span className="min-w-0 text-[15px]">
                <span className="truncate">{loan.name}</span>
                <span className="ml-2 text-[12px] uppercase tracking-[0.06em] text-ink-faint">
                  {loan.tenure_months} left · due the {loan.due_day}
                </span>
              </span>
              <span className="flex shrink-0 items-baseline gap-4">
                <Money amount={Number(loan.emi)} />
                <form action={deleteLoan}>
                  <input type="hidden" name="id" value={loan.id} />
                  <SubmitText pendingLabel="Removing…">Remove</SubmitText>
                </form>
              </span>
            </li>
          ))}
        </ul>
      )}

      <StepFooter
        from="commitments"
        label={loans.length > 0 ? 'Continue' : 'Nothing owed — skip'}
        note={
          loans.length > 0
            ? `${inr(balance.loanEmis)} a month, until each one runs out.`
            : 'Add them later from the loans page if that changes.'
        }
      />
    </div>
  );
}
