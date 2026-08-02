import { redirect } from 'next/navigation';
import { loadSnapshot } from '@/lib/db/repository';
import { saveOnboardingBalances } from '@/lib/actions';
import { onboardingGuard } from '@/lib/onboarding';
import { inr } from '@/lib/format';
import { StepBack, StepError, StepHeading } from '@/components/onboarding';
import { AmountSuggest } from '@/components/amount-suggest';
import { Field, Input } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { IconArrowRight } from '@/components/icons';

export const dynamic = 'force-dynamic';

/**
 * Step 2. What you have, and the line you will not cross.
 *
 * The floor is the one number that turns a projection into a warning: without
 * it every plan looks fine right up to the month the account empties. Nobody
 * arrives with a figure in mind, so the step offers three built off the salary
 * already entered rather than asking and leaving the field blank.
 */
export default async function BalancesStepPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const snapshot = await loadSnapshot();
  const elsewhere = onboardingGuard(snapshot.profile, 'balances');
  if (elsewhere) redirect(elsewhere);

  const { error } = await searchParams;

  const salary = Number(
    snapshot.income.find((i) => i.type === 'salary')?.amount ?? 0,
  );
  // Rounded to the nearest ten thousand: a floor of ₹1,74,000 pretends to a
  // precision the rule of thumb behind it does not have.
  const round = (value: number) => Math.round(value / 10_000) * 10_000;

  return (
    <div className="space-y-7">
      <StepHeading
        slug="balances"
        title="What you have"
        blurb="Savings you can actually reach — the balance you would spend from tomorrow if something broke. Locked deposits, PF and anything with a notice period are not this."
      />

      {error === 'savings' && (
        <StepError>
          Put a figure in — zero is a perfectly good answer, and the app will say
          so plainly. It just cannot be left empty.
        </StepError>
      )}

      <form action={saveOnboardingBalances} className="space-y-7">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Available savings"
            hint="Bank balance, sweep FDs, liquid funds — anything you could use this week"
          >
            <Input
              id="liquid_corpus"
              name="liquid_corpus"
              type="number"
              step="1"
              min={0}
              inputMode="numeric"
              placeholder="200000"
              defaultValue={Number(snapshot.profile.liquid_corpus) || ''}
              required
              autoFocus
            />
          </Field>

          <Field
            label="Emergency floor"
            hint="The line you never cross. Anything that would take savings below it is flagged red, everywhere."
          >
            <Input
              id="emergency_floor"
              name="emergency_floor"
              type="number"
              step="1"
              min={0}
              inputMode="numeric"
              defaultValue={Number(snapshot.profile.emergency_floor)}
            />
            {salary > 0 && (
              <AmountSuggest
                target="emergency_floor"
                options={[
                  { label: `3 months · ${inr(round(salary * 3), { compact: true })}`, value: round(salary * 3) },
                  { label: `6 months · ${inr(round(salary * 6), { compact: true })}`, value: round(salary * 6) },
                  { label: 'Decide later · ₹0', value: 0 },
                ]}
              />
            )}
          </Field>
        </div>

        <p className="max-w-prose border-l-2 border-l-line pl-4 text-[14px] leading-relaxed text-ink-faint">
          Three to six months of costs is the usual advice; the figures offered
          are months of salary, which is close enough until the next step tells
          the app what your month actually costs. Nothing here is locked in — it
          all lives in Settings afterwards.
        </p>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line pt-5">
          <SubmitButton pendingLabel="Saving…">
            Continue
            <IconArrowRight size={15} />
          </SubmitButton>
          <span className="text-[14px] text-ink-faint">
            That is everything the app cannot work without.
          </span>
          <StepBack from="balances" />
        </div>
      </form>
    </div>
  );
}
