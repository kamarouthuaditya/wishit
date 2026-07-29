import { redirect } from 'next/navigation';
import { loadSnapshot } from '@/lib/db/repository';
import { currentUser } from '@/lib/supabase/server';
import { saveOnboardingIncome } from '@/lib/actions';
import { onboardingGuard } from '@/lib/onboarding';
import { StepError, StepHeading, StepNotice } from '@/components/onboarding';
import { Button, Field, Input, Select } from '@/components/ui';
import { IconArrowRight } from '@/components/icons';

export const dynamic = 'force-dynamic';

/**
 * Step 1. The number every other number in the app is a share of.
 *
 * Salary is the only required field. The bonus is here rather than in Settings
 * because "wait for the bonus" is one of the three answers the app gives to
 * "can I afford this?", and it cannot give it if nobody ever mentions one.
 */
export default async function IncomeStepPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const snapshot = await loadSnapshot();
  const elsewhere = onboardingGuard(snapshot.profile, 'income');
  if (elsewhere) redirect(elsewhere);

  const { error, created } = await searchParams;

  // The name came in at sign-up; do not ask for it twice.
  const user = await currentUser();
  const meta = (user?.user_metadata ?? {}) as {
    first_name?: string;
    last_name?: string;
  };
  const knownName =
    [meta.first_name, meta.last_name].filter(Boolean).join(' ') ||
    (snapshot.profile.name === 'Me' ? '' : snapshot.profile.name);

  const salary = snapshot.income.find((i) => i.type === 'salary');
  const bonus = snapshot.income.find((i) => i.type === 'bonus');

  return (
    <div className="space-y-7">
      <StepHeading
        slug="income"
        title="What comes in"
        blurb="One number does most of the work here: what actually reaches your account each month. Everything the app says later is a share of it."
      />

      {created && (
        <StepNotice>
          Your account is created and your email is confirmed — you are signed
          in. Six short steps and the numbers start meaning something.
        </StepNotice>
      )}

      {error === 'salary' && (
        <StepError>
          A monthly salary above zero is needed — every projection divides by it.
          If your income varies, put in a month you would not be surprised by.
        </StepError>
      )}

      <form action={saveOnboardingIncome} className="space-y-7">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Net monthly salary"
            hint="What reaches your account, after tax and deductions"
          >
            <Input
              name="net_salary"
              type="number"
              step="1"
              min={1}
              inputMode="numeric"
              placeholder="120000"
              defaultValue={salary ? Number(salary.amount) : ''}
              required
              autoFocus
            />
          </Field>
          <Field label="Pay date" hint="Day of the month it lands">
            <Input
              name="pay_date"
              type="number"
              min={1}
              max={31}
              defaultValue={snapshot.profile.pay_date}
            />
          </Field>
        </div>

        <section className="border-t border-line pt-6">
          <h2 className="eyebrow">If you get a bonus</h2>
          <p className="mt-1.5 max-w-prose text-[13px] text-ink-faint">
            Leave it at zero if you do not. It matters because a purchase that is
            out of reach today is often just a purchase that waits for March.
          </p>

          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <Field label="Annual bonus">
              <Input
                name="bonus_amount"
                type="number"
                step="1"
                inputMode="numeric"
                defaultValue={bonus ? Number(bonus.amount) : 0}
              />
            </Field>
            <Field label="Due in" hint="Months from now">
              <Input
                name="bonus_month"
                type="number"
                min={1}
                max={12}
                defaultValue={bonus?.bonus_month ?? 4}
              />
            </Field>
            <Field label="Count it as">
              <Select name="bonus_mode" defaultValue={snapshot.profile.bonus_mode}>
                <option value="lump">A lump sum, in its month</option>
                <option value="amortised">Spread across 12 months</option>
              </Select>
            </Field>
          </div>
        </section>

        <section className="border-t border-line pt-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Your name" hint="Used to address you, nothing else">
              <Input name="name" placeholder="Me" defaultValue={knownName} />
            </Field>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line pt-5">
          <Button type="submit">
            Continue
            <IconArrowRight size={15} />
          </Button>
          <span className="text-[13px] text-ink-faint">
            Next: what you have saved.
          </span>
        </div>
      </form>
    </div>
  );
}
