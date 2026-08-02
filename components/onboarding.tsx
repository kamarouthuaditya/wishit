import Link from 'next/link';
import type { ReactNode } from 'react';
import { advanceOnboarding } from '@/lib/actions';
import { ONBOARDING_ROOT, previousStep, stepIndex } from '@/lib/onboarding';
import { SubmitButton } from '@/components/submit-button';
import { IconArrowRight } from '@/components/icons';
import { BalancesArt } from '@/components/illustrations/balances';
import { ExpensesArt } from '@/components/illustrations/expenses';
import { IncomeArt } from '@/components/illustrations/income';
import { OweArt } from '@/components/illustrations/owe';
import { SavingsArt } from '@/components/illustrations/savings';
import { inr } from '@/lib/format';

/**
 * The furniture every onboarding step shares: a heading that says what is being
 * asked and why, a foot with one obvious way forward, and a live figure so the
 * numbers being typed visibly do something before the dashboard is ever
 * reached.
 */

/**
 * One picture per question, and none for the last step.
 *
 * `appearance` is the theme picker: it is already three coloured swatches
 * arguing for themselves, and a drawing beside them would be a fourth thing to
 * look at on the one screen that is about looking.
 *
 * The colours come from `var(--...)`, so the art follows the ground it is on
 * and a custom accent moves it too — see `scripts/build-illustrations.mjs`.
 */
const STEP_ART: Record<string, (props: { className?: string }) => ReactNode> = {
  income: IncomeArt,
  balances: BalancesArt,
  expenses: ExpensesArt,
  commitments: OweArt,
  goals: SavingsArt,
};

export function StepHeading({
  slug,
  title,
  blurb,
}: {
  slug: string;
  title: string;
  blurb: ReactNode;
}) {
  const index = stepIndex(slug);
  const Art = STEP_ART[slug];

  return (
    <header className="flex items-start gap-8">
      <div className="min-w-0 flex-1">
        <p className="eyebrow text-accent">Step {index + 1}</p>
        <h1 className="mt-2 font-display text-[30px] leading-none sm:text-[34px]">
          {title}
        </h1>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
          {blurb}
        </p>
      </div>

      {/* Height is fixed and width follows, because the set was not drawn to
          one aspect ratio: matched on width, the near-square ones would stand
          twice as tall as the wide ones and the heading would move down the
          page from step to step. Gone below `sm`, where the choice is between
          a picture and the first field being visible. */}
      {Art && (
        <Art className="hidden h-28 w-auto max-w-[42%] shrink-0 sm:block" />
      )}
    </header>
  );
}

/**
 * Forward and back for the optional steps.
 *
 * Skip and Continue are the same act — move on — so they are one button whose
 * label tells the truth about what is behind it. Two buttons doing one thing
 * only asks people to wonder what the difference is.
 */
export function StepFooter({
  from,
  label,
  note,
}: {
  from: string;
  label: string;
  note?: ReactNode;
}) {
  const back = previousStep(from);

  return (
    <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line pt-5">
      <form action={advanceOnboarding}>
        <input type="hidden" name="from" value={from} />
        <SubmitButton pendingLabel="Saving…">
          {label}
          <IconArrowRight size={15} />
        </SubmitButton>
      </form>

      {note && <span className="text-[14px] text-ink-faint">{note}</span>}

      {back && (
        <Link
          href={`${ONBOARDING_ROOT}/${back.slug}`}
          className="ml-auto text-[14px] text-ink-faint transition-colors duration-[140ms] hover:text-accent"
        >
          ← {back.title}
        </Link>
      )}
    </div>
  );
}

/** The back link on its own, for steps whose Continue is a form submit. */
export function StepBack({ from }: { from: string }) {
  const back = previousStep(from);
  if (!back) return null;
  return (
    <Link
      href={`${ONBOARDING_ROOT}/${back.slug}`}
      className="ml-auto text-[14px] text-ink-faint transition-colors duration-[140ms] hover:text-accent"
    >
      ← {back.title}
    </Link>
  );
}

/**
 * The balance, quoted mid-sequence.
 *
 * The point of every optional step is that it changes this number. Showing it
 * as it moves is the whole argument for filling the step in, and it is a
 * stronger one than any amount of copy explaining why you should.
 *
 * Which is why it is set larger than the step heading above it. At 28px it was
 * smaller than its own title — the argument typeset as a footnote — and read as
 * a detail attached to the question rather than the reason for asking it. It is
 * the hero of the step, so it is sized like one: above `Stat large`, below the
 * dashboard's own hero, which is still the biggest figure in the product.
 *
 * A plain hairline rather than a `lead` accent rule, though. The rail above
 * already spends this view's one accent top-edge on marking where you are, and
 * a second would just split the attention it exists to direct.
 */
export function RunningBalance({
  balance,
  caveat,
}: {
  balance: number;
  caveat: string;
}) {
  const tone = balance < 0 ? 'text-bad' : 'text-good';
  return (
    <aside className="border border-line bg-surface px-5 py-5">
      <p className="eyebrow text-[11px]">Balance left each month, so far</p>
      <p
        className={`tnum font-display mt-3 text-[40px] leading-none sm:text-[48px] ${tone}`}
      >
        {inr(balance)}
      </p>
      <p className="mt-3 max-w-prose text-[14px] leading-snug text-ink-faint">
        {caveat}
      </p>
    </aside>
  );
}

/** A validation line, shown only when a step bounced a submission back. */
/**
 * Said once, on the first screen after a code is accepted.
 *
 * Verifying used to drop people straight into a form. The account had been
 * created, the address confirmed and the session minted, and nothing on screen
 * mentioned any of it — so the one moment worth confirming looked identical to
 * being bounced back to the start.
 */
export function StepNotice({ children }: { children: ReactNode }) {
  return (
    <p className="border border-good/50 bg-good-soft px-4 py-3 text-[14px] text-good">
      {children}
    </p>
  );
}

export function StepError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="border border-bad/50 bg-bad-soft px-4 py-3 text-[14px] text-bad"
    >
      {children}
    </p>
  );
}
