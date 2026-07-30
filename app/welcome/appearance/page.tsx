import { redirect } from 'next/navigation';
import { loadSnapshot } from '@/lib/db/repository';
import { finishOnboarding } from '@/lib/actions';
import { onboardingGuard } from '@/lib/onboarding';
import { monthlyBalance } from '@/lib/model/balance';
import { inr } from '@/lib/format';
import { StepBack, StepHeading } from '@/components/onboarding';
import { ThemeToggle } from '@/components/theme-toggle';
import { SubmitButton } from '@/components/submit-button';
import { IconArrowRight } from '@/components/icons';

export const dynamic = 'force-dynamic';

/**
 * The last step. Theme, and a reckoning of what was actually entered.
 *
 * Appearance is last on purpose: it is the one choice here where being wrong
 * costs nothing, so it makes a poor gate and a good exhale. The summary beside
 * it is the real work of the screen — the first thing anyone wants after
 * answering six screens of questions is to see the answers back.
 */
export default async function AppearanceStepPage() {
  const snapshot = await loadSnapshot();
  const elsewhere = onboardingGuard(snapshot.profile, 'appearance');
  if (elsewhere) redirect(elsewhere);

  const balance = monthlyBalance(snapshot);
  const salary = Number(
    snapshot.income.find((i) => i.type === 'salary')?.amount ?? 0,
  );

  const lines: [string, string][] = [
    ['Salary', `${inr(salary)} a month, on the ${snapshot.profile.pay_date}th`],
    [
      'Savings',
      `${inr(Number(snapshot.profile.liquid_corpus))}, floor at ${inr(Number(snapshot.profile.emergency_floor))}`,
    ],
    [
      'The month costs',
      snapshot.expenses.length === 0
        ? 'nothing entered yet'
        : `${inr(balance.expenses)} across ${snapshot.expenses.length} lines`,
    ],
    [
      'Owed',
      snapshot.loans.length === 0
        ? 'nothing'
        : `${inr(balance.loanEmis)} a month of EMIs`,
    ],
    [
      'Goals',
      snapshot.goals.length === 0
        ? 'none yet'
        : `${snapshot.goals.length}, taking ${inr(balance.goalContributions)} a month`,
    ],
  ];

  return (
    <div className="space-y-7">
      <StepHeading
        slug="appearance"
        title="How it looks"
        blurb="Light is the default because the fifteen-second use is a phone in daylight. Dark and money are the same app in a different register — they change nothing about what it says."
      />

      <ThemeToggle />

      <section className="border border-line bg-surface">
        <header className="border-b border-line px-5 py-3.5">
          <h2 className="eyebrow">What the app knows so far</h2>
        </header>
        <dl className="divide-y divide-line px-5">
          {lines.map(([label, value]) => (
            <div
              key={label}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
            >
              <dt className="text-[13px] text-ink-faint">{label}</dt>
              <dd className="text-[14px] text-ink-soft">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-line-strong px-5 py-4">
          <p className="eyebrow text-[10px]">Balance left each month</p>
          <p
            className={`tnum font-display mt-1.5 text-[32px] leading-none ${
              balance.balance < 0 ? 'text-bad' : 'text-good'
            }`}
          >
            {inr(balance.balance)}
          </p>
          <p className="mt-2 max-w-prose text-[12px] text-ink-faint">
            Everything above is editable in Settings, and anything skipped has a
            page of its own. Nothing here is a decision you are stuck with.
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line pt-5">
        <form action={finishOnboarding}>
          <SubmitButton pendingLabel="Opening…">
            Open my dashboard
            <IconArrowRight size={15} />
          </SubmitButton>
        </form>
        <span className="text-[13px] text-ink-faint">
          Setup does not come back.
        </span>
        <StepBack from="appearance" />
      </div>
    </div>
  );
}
