import {
  deleteExpense,
  deleteGoal,
  saveExpense,
  saveGoal,
  setGoalContribution,
  setGoalStatus,
  updateProfile,
} from '@/lib/actions';
import { loadReadySnapshot, loadSnapshot } from '@/lib/db/repository';
import { toEngineInput } from '@/lib/model/to-engine';
import { buildSavingsPlan, planningTotals, simulate } from '@/lib/engine';
import { deadlineMonths } from '@/lib/model/funding';
import { monthlyBalance } from '@/lib/model/balance';
import { monthKey, monthTitle } from '@/lib/model/spending';
import { nextBilledMonth } from '@/lib/model/billing';
import type { TransferParty } from '@/lib/model/transfer';
import { GoalTransfer } from '@/components/goal-transfer';
import { GoalComposer } from '@/components/goal-composer';
import { ContributionNote } from '@/components/contribution-note';
import { PageGuide } from '@/components/page-guide';
import { inr, isoDate, monthLabel, pct } from '@/lib/format';
import {
  Bar,
  Button,
  Empty,
  Field,
  Input,
  Money,
  Pill,
  Section,
  Select,
} from '@/components/ui';
import { IconCheck, IconEdit, IconTransfer } from '@/components/icons';
import { ConfirmButton } from '@/components/confirm-button';
import type { ExpenseItemRow, GoalRow } from '@/lib/db/types';
import { now as clockNow } from '@/lib/clock';

export const dynamic = 'force-dynamic';

const FREQUENCIES = [
  { value: '1', label: 'Monthly' },
  { value: '3', label: 'Quarterly' },
  { value: '6', label: 'Half-yearly' },
  { value: '12', label: 'Yearly' },
];

/** One control's box, for the add rows that have no room for labels. */
const control =
  'border border-line bg-paper px-3 py-2.5 text-ink outline-none ' +
  'transition-colors duration-[140ms] hover:border-line-strong focus:border-accent ' +
  'placeholder:text-ink-faint';

/**
 * Goals, as a list.
 *
 * Every goal used to render its contribution form, a transfer form, a six-row
 * pace table, a lifecycle button and an edit panel, all expanded, all the time:
 * three goals made a four-thousand-pixel page, and the one number that matters
 * — what this goal takes each month — was buried in the middle of it.
 *
 * A goal is now a row you can read in a second. Everything that acts on it is
 * one click away, on the goal you clicked.
 */
export default async function GoalsPage() {
  const snapshot = await loadReadySnapshot();
  const { input, anchor } = toEngineInput(snapshot);

  // Two runs: with committed wishlist EMIs, and without. The gap is what the
  // wishlist has already cost.
  const withCommitted = simulate(input);
  const clean = simulate({ ...input, purchases: [] });
  const plan = planningTotals(input);
  const balance = monthlyBalance(snapshot);
  const savingsLines = snapshot.expenses.filter((e) => e.type === 'investment');

  return (
    <div className="space-y-8 pb-28">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[30px] leading-none">Goals</h1>
            <PageGuide guide="goals" />
          </div>
          <p className="mt-3 max-w-prose text-[14px] text-ink-soft">
            Everything you are building up. Ranked: when money is tight the ones
            lower down get squeezed first, and protected goals are drawn on last.
          </p>
        </div>

        <dl className="flex items-end gap-px border border-line bg-line">
          <Figure label="Into goals" value={balance.goalContributions} />
          <Figure label="Into savings" value={plan.investments} />
          <Figure label="Balance left" value={balance.balance} lead />
        </dl>
      </header>

      {/*
        A control bar, so it reads as something that governs the list below it
        rather than a stray field between the title and the goals.
      */}
      <form
        action={updateProfile}
        className="flex flex-wrap items-center gap-3 border border-line bg-surface px-5 py-3"
      >
        <span className="eyebrow">Split surplus by</span>
        <div className="min-w-[16rem] max-w-sm flex-1">
          <Select
            name="allocation_mode"
            defaultValue={snapshot.profile.allocation_mode}
            className="mt-0 py-1.5 text-[13px]"
          >
            <option value="waterfall">Priority order — fill the top goal first</option>
            <option value="fixed">Fixed amount into each</option>
            <option value="proportional">Split proportionally</option>
          </Select>
        </div>
        <Button variant="ghost" type="submit" size="sm">
          Apply
        </Button>
      </form>

      {snapshot.goals.length === 0 ? (
        <Empty>
          No goals yet. An emergency fund is the usual first — add one below.
        </Empty>
      ) : (
        <Section
          title="Goals"
          hint="In priority order — the top one is filled first, and a protected goal is drawn on last"
          aside={
            <>
              <Money amount={balance.goalContributions} />
              <span className="ml-1 text-[11px] font-normal text-ink-faint">
                /mo
              </span>
            </>
          }
        >
          <ul className="divide-y divide-line">
            {snapshot.goals.map((row) => (
              <GoalRow
                key={row.id}
                row={row}
                snapshot={snapshot}
                anchor={anchor}
                withCommitted={withCommitted}
                clean={clean}
                balanceLeft={balance.balance}
              />
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="Savings & investments"
        hint="SIPs, deposits, retirement — committed before anything is left over"
        aside={
          <>
            <Money amount={plan.investments} />
            <span className="ml-1 text-[11px] font-normal text-ink-faint">
              this month
            </span>
          </>
        }
        footer={
          /*
            Each control in its own box. It was one strip of segments split by
            1px gaps, which left the frequency `select` with no edge of its own
            — a word in a row, with a small arrow as the only hint that it
            opened anything.
          */
          <form action={saveExpense} className="flex flex-wrap items-stretch gap-2">
            <input type="hidden" name="type" value="investment" />
            <input type="hidden" name="effective_from" value={isoDate()} />
            <input
              name="name"
              required
              placeholder="Index SIP, recurring deposit…"
              aria-label="Name"
              className={`${control} min-w-[10rem] flex-[1.5] text-[14px]`}
            />
            <div
              className={`${control} flex min-w-[7rem] flex-1 items-center gap-2 py-0`}
            >
              <span aria-hidden className="text-ink-faint">
                ₹
              </span>
              <input
                name="amount"
                type="number"
                step="1"
                required
                placeholder="0"
                aria-label="Amount per instalment"
                className="tnum w-full bg-transparent py-2.5 text-[15px] outline-none placeholder:text-ink-faint"
              />
            </div>
            <select
              name="frequency_months"
              defaultValue="1"
              aria-label="How often"
              className={`${control} min-w-[8rem] text-[13px]`}
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label.toLowerCase()}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm">
              Add
            </Button>
          </form>
        }
      >
        {savingsLines.length === 0 ? (
          <p className="py-4 text-[13px] text-ink-faint">
            Nothing yet. Add a line below — a SIP or a recurring deposit.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {savingsLines.map((line) => (
              <SavingsRow key={line.id} row={line} />
            ))}
          </ul>
        )}
      </Section>

      <GoalComposer />
    </div>
  );
}

function Figure({
  label,
  value,
  lead,
}: {
  label: string;
  value: number;
  lead?: boolean;
}) {
  return (
    <div className={`bg-surface px-4 py-2.5 ${lead ? 'border-t-2 border-t-accent' : ''}`}>
      <dt className="eyebrow text-[10px]">{label}</dt>
      <dd className={`tnum mt-1 ${lead ? 'text-[17px] font-semibold' : 'text-[15px]'}`}>
        <Money amount={value} />
      </dd>
    </div>
  );
}

/** The date funding actually stops, from whichever rule bites first. */
function stopDateOf(goal: GoalRow): string | null {
  const dates = [
    goal.contribute_until,
    goal.stop_at_deadline ? goal.deadline : null,
  ].filter((d): d is string => d != null);
  return dates.length > 0 ? dates.sort()[0] : null;
}

/** Whole months from the current month to `date`. Negative once it is past. */
function monthsAhead(date: string, now = clockNow()): number {
  const target = new Date(date);
  return (
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth())
  );
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

function GoalRow({
  row,
  snapshot,
  anchor,
  withCommitted,
  clean,
  balanceLeft,
}: {
  row: GoalRow;
  snapshot: Awaited<ReturnType<typeof loadSnapshot>>;
  anchor: Date;
  withCommitted: ReturnType<typeof simulate>;
  clean: ReturnType<typeof simulate>;
  balanceLeft: number;
}) {
  const target = Number(row.target);
  const current = Number(row.current_amount);
  const outcome = withCommitted.goals.find((g) => g.goalId === row.id)!;
  const before = clean.goals.find((g) => g.goalId === row.id)!;
  const delta =
    outcome.completionMonth != null && before.completionMonth != null
      ? outcome.completionMonth - before.completionMonth
      : null;

  const takes =
    withCommitted.months[0].goals.find((g) => g.goalId === row.id)?.required ?? 0;
  const spareForGoal = Math.max(0, balanceLeft + takes);

  const isDone = row.status === 'done';
  const stopDate = stopDateOf(row);
  const stopped = stopDate != null && monthsAhead(stopDate) < 1;
  const funded = current >= target;
  const dormant = isDone || stopped;
  const progress = target > 0 ? current / target : 0;

  return (
    <li className={dormant ? 'opacity-60' : ''}>
      <details className="group">
        <summary className="-mx-5 grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-2 px-5 py-4 transition-colors duration-[140ms] hover:bg-paper group-open:bg-paper">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[16px]">{row.name}</span>
              <span className="text-[11px] text-ink-faint">#{row.priority}</span>
              {isDone && <Pill tone="good">done</Pill>}
              {!isDone && stopped && <Pill tone="neutral">not funded</Pill>}
              {!isDone && !stopped && funded && <Pill tone="good">reached</Pill>}
              {row.is_protected && <Pill tone="accent">protected</Pill>}
              {!dormant && outcome.missedDeadline && <Pill tone="warn">behind</Pill>}
            </div>

            <div className="mt-2 max-w-sm">
              <Bar
                value={progress}
                max={1}
                tone={dormant ? 'neutral' : outcome.missedDeadline ? 'warn' : 'accent'}
              />
            </div>

            <p className="mt-1.5 text-[12px] text-ink-faint">
              {inr(current, { compact: true })} of {inr(target, { compact: true })}
              {' · '}
              {dormant
                ? isDone
                  ? 'finished with'
                  : `funding ended ${monthTitle(stopDate!.slice(0, 7))}`
                : outcome.completionMonth == null
                  ? 'not funded inside the horizon'
                  : `ready ${monthLabel(outcome.completionMonth, anchor)}`}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="tnum text-[17px]">
                {takes > 0 ? inr(takes) : '—'}
                <span className="ml-1 text-[11px] text-ink-faint">/mo</span>
              </div>
              {delta != null && delta > 0.05 && (
                <div className="text-[11px] text-warn">
                  +{delta.toFixed(1)}mo from purchases
                </div>
              )}
            </div>
            <span className="shrink-0 text-ink-faint opacity-0 transition-opacity duration-[140ms] group-hover:opacity-100">
              <IconEdit size={15} />
            </span>
          </div>
        </summary>

        {/*
          The open goal's own well: the page ground, inset inside the section's
          surface, so everything under the heading plainly belongs to the goal
          above it. It used to sit on the same ground as the rows either side of
          it, which is what made a long expanded goal read as page furniture
          rather than as one goal's controls.
        */}
        <div className="-mx-5 space-y-6 border-y border-line bg-paper px-5 py-5">
          {dormant ? (
            <p className="text-[14px] text-ink-soft">
              {isDone
                ? `Marked done. The ${inr(current)} saved stays here; nothing more goes in.`
                : `Funding stopped after ${monthTitle(stopDate!.slice(0, 7))}. The ${inr(current)} saved stays here — clear the stop date below to resume.`}
            </p>
          ) : (
            <>
              {takes > 0 && (
                <ContributionNote
                  target={target}
                  current={current}
                  funding={takes}
                  deadlineMonths={deadlineMonths(row)}
                  returnPct={Number(row.expected_return_pct)}
                />
              )}

              <form
                action={setGoalContribution}
                className="flex flex-wrap items-end gap-4"
              >
                <input type="hidden" name="id" value={row.id} />
                <div className="w-40">
                  <Field label="Monthly contribution">
                    <Input
                      name="fixed_contribution"
                      type="number"
                      step="1"
                      defaultValue={
                        row.fixed_contribution != null
                          ? Number(row.fixed_contribution)
                          : ''
                      }
                      placeholder={String(Math.round(takes))}
                    />
                  </Field>
                </div>
                <Button variant="ghost" type="submit" size="sm">
                  Save
                </Button>
                <p className="flex-1 text-[12px] text-ink-faint">
                  Leave it blank and the goal is filled from what is left, in
                  priority order.
                </p>
              </form>

              <SavingsPace
                target={target}
                current={current}
                spare={spareForGoal}
                returnPct={Number(row.expected_return_pct)}
              />
            </>
          )}

          <div className="border-t border-line pt-5">
            <h3 className="section-title flex items-center gap-2 text-[12px]">
              <IconTransfer size={13} />
              Move money in
            </h3>
            <GoalTransfer
              destination={toParty(row)}
              sources={snapshot.goals
                .filter((g) => g.id !== row.id && Number(g.current_amount) > 0)
                .map(toParty)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-line pt-5">
            <form action={setGoalStatus}>
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="status" value={isDone ? 'active' : 'done'} />
              <Button variant="ghost" type="submit" size="sm">
                <IconCheck size={14} />
                {isDone ? 'Reopen' : 'Mark done'}
              </Button>
            </form>
            <details className="flex-1 text-[13px]">
              <summary className="cursor-pointer text-ink-faint transition-colors hover:text-accent">
                Edit the details
              </summary>
              <GoalEditor row={row} />
            </details>
          </div>
        </div>
      </details>
    </li>
  );
}

function GoalEditor({ row }: { row: GoalRow }) {
  return (
    <form action={saveGoal} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="id" value={row.id} />
      <Field label="Name">
        <Input name="name" defaultValue={row.name} />
      </Field>
      <Field label="Target">
        <Input name="target" type="number" defaultValue={Number(row.target)} />
      </Field>
      <Field label="Saved so far">
        <Input
          name="current_amount"
          type="number"
          defaultValue={Number(row.current_amount)}
        />
      </Field>
      <Field label="Target date" hint="Sets the pace it needs">
        <Input
          name="deadline"
          type="date"
          defaultValue={row.deadline?.slice(0, 10) ?? ''}
        />
      </Field>
      <Field label="Stop funding after" hint="Blank means until it is full">
        <Input
          name="contribute_until"
          type="date"
          defaultValue={row.contribute_until?.slice(0, 10) ?? ''}
        />
      </Field>
      <Field label="Priority" hint="1 is highest">
        <Input name="priority" type="number" min={1} defaultValue={row.priority} />
      </Field>
      <Field label="Expected return (%)" hint="Per year. 0 is fine.">
        <Input
          name="expected_return_pct"
          type="number"
          step="0.1"
          defaultValue={Number(row.expected_return_pct)}
        />
      </Field>
      <Field label="Weight" hint="Proportional mode only">
        <Input
          name="weight"
          type="number"
          step="0.1"
          defaultValue={Number(row.weight)}
        />
      </Field>

      <label className="flex items-center gap-2 pb-2 text-[13px]">
        <input
          type="checkbox"
          name="stop_at_deadline"
          defaultChecked={row.stop_at_deadline}
          className="size-4 accent-[var(--accent)]"
        />
        Stop at the target date
      </label>
      <label className="flex items-center gap-2 pb-2 text-[13px]">
        <input
          type="checkbox"
          name="is_protected"
          defaultChecked={row.is_protected}
          className="size-4 accent-[var(--accent)]"
        />
        Protected
      </label>

      <div className="flex items-end gap-2 pb-1">
        <Button type="submit" size="sm">Save</Button>
        <ConfirmButton
          action={deleteGoal}
          id={row.id}
          confirm={`Delete ${row.name}? The ${inr(Number(row.current_amount))} saved is not moved anywhere.`}
        />
      </div>
    </form>
  );
}

/**
 * "I want ₹1,00,000 — what is that per month?", with the paces that fit marked.
 * Collapsed by default: it is a planning aid, not a status line.
 */
function SavingsPace({
  target,
  current,
  spare,
  returnPct,
}: {
  target: number;
  current: number;
  spare: number;
  returnPct: number;
}) {
  const plan = buildSavingsPlan({ target, current, spare, annualReturnPct: returnPct });

  if (plan.remaining <= 0) {
    return (
      <p className="border-t border-good/40 pt-3 text-[14px] text-good">
        Target reached — {inr(current)} against {inr(target)}.
      </p>
    );
  }

  return (
    <details className="border-t border-line pt-4">
      <summary className="cursor-pointer text-[13px] text-ink-faint transition-colors hover:text-accent">
        {inr(plan.remaining)} still to go — what each pace costs
      </summary>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[380px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.08em] text-ink-faint">
              <th className="py-2 pr-4 font-semibold">Timeframe</th>
              <th className="py-2 pr-4 text-right font-semibold">Per month</th>
              <th className="py-2 pr-4 text-right font-semibold">% of balance</th>
              <th className="py-2 text-right font-semibold">Fits</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {plan.options.map((option) => (
              <tr key={option.months}>
                <td className="py-2 pr-4 text-ink-soft">{option.months} months</td>
                <td className="py-2 pr-4 text-right">
                  <Money
                    amount={option.monthly}
                    tone={option.affordable ? 'neutral' : 'bad'}
                  />
                </td>
                <td className="tnum py-2 pr-4 text-right text-ink-faint">
                  {Number.isFinite(option.shareOfSpare)
                    ? pct(option.shareOfSpare, 0)
                    : '—'}
                </td>
                <td className="py-2 text-right">
                  {option.affordable ? (
                    <Pill tone="good">yes</Pill>
                  ) : (
                    <Pill tone="bad">no</Pill>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[12px] text-ink-soft">
        {spare <= 0 ? (
          <span className="text-bad">
            Nothing is left over once expenses, EMIs and other commitments are paid,
            so none of these are reachable until something changes.
          </span>
        ) : plan.soonestAffordable ? (
          <>
            This goal has <strong>{inr(spare)}</strong> a month to work with. The
            fastest that fits is {plan.soonestAffordable.months} months at{' '}
            {inr(plan.soonestAffordable.monthly)}.
          </>
        ) : (
          <>
            This goal has <strong>{inr(spare)}</strong> a month to work with, short
            of every option above.
          </>
        )}
      </p>
    </details>
  );
}

function SavingsRow({ row }: { row: ExpenseItemRow }) {
  const every = Math.max(1, row.frequency_months ?? 1);
  // Full amount and its month, the same as an expense row: an annual deposit is
  // an annual deposit, not a twelfth of one you never actually make.
  const nextDue = nextBilledMonth(row, monthKey());

  return (
    <li>
      <details className="group">
        <summary className="-mx-5 flex cursor-pointer list-none items-baseline gap-4 px-5 py-3 transition-colors duration-[140ms] hover:bg-paper group-open:bg-paper">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px]">{row.name}</span>
            {every > 1 && (
              <span className="text-[12px] text-ink-faint">
                every {every} months
                {nextDue ? ` · next ${monthTitle(nextDue)}` : ' · ended'}
              </span>
            )}
          </span>
          <span className="tnum shrink-0 text-[15px]">
            {inr(Number(row.amount))}
            <span className="ml-1 text-[11px] text-ink-faint">
              {every > 1 ? 'a time' : '/mo'}
            </span>
          </span>
          <span className="shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">
            <IconEdit size={15} />
          </span>
        </summary>

        <form
          action={saveExpense}
          className="-mx-5 grid gap-x-4 gap-y-5 border-y border-line bg-paper px-5 py-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="type" value="investment" />
          <Field label="Name">
            <Input name="name" defaultValue={row.name} />
          </Field>
          <Field label="Amount">
            <Input
              name="amount"
              type="number"
              step="1"
              defaultValue={Number(row.amount)}
            />
          </Field>
          <Field label="Billed">
            <Select name="frequency_months" defaultValue={String(every)}>
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Starts">
            <Input
              name="effective_from"
              type="date"
              defaultValue={row.effective_from?.slice(0, 10)}
            />
          </Field>
          <div className="flex items-end gap-2 pb-1">
            <Button type="submit" size="sm">Save</Button>
            <ConfirmButton
              action={deleteExpense}
              id={row.id}
              confirm={`Delete ${row.name}?`}
            />
          </div>
        </form>
      </details>
    </li>
  );
}
