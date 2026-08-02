import { redirect } from 'next/navigation';
import { loadSnapshot } from '@/lib/db/repository';
import { deleteGoal, saveGoal } from '@/lib/actions';
import { onboardingGuard } from '@/lib/onboarding';
import { monthlyBalance } from '@/lib/model/balance';
import { inr } from '@/lib/format';
import { RunningBalance, StepFooter, StepHeading } from '@/components/onboarding';
import { Money, Pill } from '@/components/ui';
import { SubmitButton, SubmitText } from '@/components/submit-button';
import { IconPlus } from '@/components/icons';

export const dynamic = 'force-dynamic';

/**
 * Step 5, optional. What the money is for.
 *
 * This is the step that makes the rest of the app answer its own question: a
 * purchase is only expensive relative to something you would rather have. With
 * no goals, "what does this cost me in time?" has nothing to measure against.
 *
 * The emergency fund is offered pre-costed from what the month actually takes,
 * because the sum nobody can produce on demand is the target, not the intent.
 */
export default async function GoalsStepPage() {
  const snapshot = await loadSnapshot();
  const elsewhere = onboardingGuard(snapshot.profile, 'goals');
  if (elsewhere) redirect(elsewhere);

  const balance = monthlyBalance(snapshot);
  const goals = snapshot.goals;

  // Six months of what the month actually takes — expenses plus EMIs, not
  // salary. Rounded, because the rule of thumb behind it is not precise.
  const monthlyOutgo = balance.expenses + balance.loanEmis;
  const suggested = Math.round((monthlyOutgo * 6) / 10_000) * 10_000;
  const hasFund = goals.some((g) => /emergency/i.test(g.name));
  const offerFund = suggested > 0 && !hasFund;

  return (
    <div className="space-y-7">
      <StepHeading
        slug="goals"
        title="What you are saving for"
        blurb="One is enough to start. Everything you later put on the wishlist is priced against these — that is the whole trick: a purchase costs you the weeks it pushes a goal back."
      />

      <RunningBalance
        balance={balance.balance}
        caveat={
          balance.goalContributions > 0
            ? `${inr(balance.goalContributions)} a month is now going into goals, and it is still your money — it sits in the same pot, earmarked.`
            : 'Goals take their share out of this once they have a target date or a set amount.'
        }
      />

      {offerFund && (
        <form action={saveGoal}>
          <input type="hidden" name="name" value="Emergency fund" />
          <input type="hidden" name="target" value={suggested} />
          <input type="hidden" name="current_amount" value={0} />
          <input type="hidden" name="priority" value={1} />
          <input type="hidden" name="is_protected" value="on" />
          <div className="border border-dashed border-line px-5 py-4">
            <p className="max-w-prose text-[15px] text-ink-soft">
              Six months of what your month costs is{' '}
              <span className="tnum text-ink">{inr(suggested)}</span>. That is the
              usual first goal, and it is protected — nothing else is allowed to
              raid it.
            </p>
            <SubmitButton
              variant="ghost"
              className="mt-4"
              pendingLabel="Adding…"
            >
              <IconPlus size={15} />
              Add emergency fund
            </SubmitButton>
          </div>
        </form>
      )}

      <form action={saveGoal} className="space-y-2">
        <div className="flex flex-wrap items-stretch gap-px overflow-hidden rounded-xl border border-line bg-line">
          <input
            name="name"
            required
            placeholder="Trip, laptop, house deposit…"
            aria-label="What you are saving for"
            className="min-w-[10rem] flex-[1.6] bg-paper px-3 py-3 text-[16px] outline-none placeholder:text-ink-faint"
          />

          <div className="flex min-w-[8rem] flex-1 items-center gap-2 bg-paper px-3">
            <span aria-hidden className="text-[16px] text-ink-faint">
              ₹
            </span>
            <input
              name="target"
              type="number"
              step="1"
              inputMode="numeric"
              required
              placeholder="target"
              aria-label="Target amount"
              className="tnum w-full bg-transparent py-3 text-[17px] font-medium outline-none placeholder:text-ink-faint"
            />
          </div>

          <label className="flex min-w-[9rem] items-center gap-2 bg-paper px-3 text-[14px] text-ink-faint">
            saved
            <input
              name="current_amount"
              type="number"
              step="1"
              inputMode="numeric"
              defaultValue={0}
              aria-label="Saved so far"
              className="tnum w-20 bg-transparent py-3 text-[16px] text-ink outline-none"
            />
          </label>

          <label className="flex min-w-[9rem] items-center gap-2 bg-paper px-3 text-[14px] text-ink-faint">
            by
            <input
              name="deadline"
              type="date"
              aria-label="Target date"
              className="w-full bg-transparent py-3 text-[14px] text-ink outline-none"
            />
          </label>

          <SubmitButton
            className="px-5 py-3 text-[14px]"
            pendingLabel="Adding…"
          >
            <IconPlus size={15} />
            Add goal
          </SubmitButton>
        </div>
        <p className="text-[13px] text-ink-faint">
          A date makes it a commitment the app funds at the rate it needs. No
          date means it is filled from whatever is spare, in priority order.
        </p>
      </form>

      {goals.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {goals.map((goal) => (
            <li
              key={goal.id}
              className="flex items-baseline justify-between gap-4 px-4 py-2.5"
            >
              <span className="flex min-w-0 items-center gap-2 text-[15px]">
                <span className="truncate">{goal.name}</span>
                {goal.is_protected && <Pill tone="accent">protected</Pill>}
              </span>
              <span className="flex shrink-0 items-baseline gap-4">
                <span className="tnum text-[14px] text-ink-soft">
                  {inr(Number(goal.current_amount), { compact: true })} /{' '}
                  <Money amount={Number(goal.target)} compact />
                </span>
                <form action={deleteGoal}>
                  <input type="hidden" name="id" value={goal.id} />
                  <SubmitText pendingLabel="Removing…">Remove</SubmitText>
                </form>
              </span>
            </li>
          ))}
        </ul>
      )}

      <StepFooter
        from="goals"
        label={goals.length > 0 ? 'Continue' : 'Skip for now'}
        note={
          goals.length > 0
            ? `${goals.length} ${goals.length === 1 ? 'goal' : 'goals'}, funded in priority order.`
            : 'The wishlist has nothing to measure against until there is one.'
        }
      />
    </div>
  );
}
