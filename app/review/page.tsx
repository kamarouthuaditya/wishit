import Link from 'next/link';
import {
  loadReadySnapshot,
  loadTransactionsForMonth,
} from '@/lib/db/repository';
import {
  applyMonthlyCorrections,
  closeOutMonth,
  deleteTransaction,
} from '@/lib/actions';
import { toEngineInput } from '@/lib/model/to-engine';
import { buildReview } from '@/lib/model/review';
import { monthKeyOf, previousSnapshot } from '@/lib/snapshot';
import { inr, monthLabel, pct } from '@/lib/format';
import {
  Button,
  Card,
  Empty,
  Field,
  Input,
  Money,
  Pill,
  TrafficLight,
} from '@/components/ui';
import {
  IconCheck,
  IconEdit,
  IconExpenses,
  IconGoal,
  IconSpending,
  IconTrash,
  IconWishlist,
} from '@/components/icons';
import { PageGuide } from '@/components/page-guide';
import { now as clockNow } from '@/lib/clock';

export const dynamic = 'force-dynamic';

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const now = clockNow();
  const month = /^\d{4}-\d{2}$/.test(params.month ?? '')
    ? `${params.month}-01`
    : monthKeyOf(now);

  const snapshot = await loadReadySnapshot();
  const { input, anchor } = toEngineInput(snapshot);
  const transactions = await loadTransactionsForMonth(month);
  const previous = previousSnapshot(snapshot.snapshots, month);
  const stored = snapshot.snapshots.find((s) => s.month.slice(0, 10) === month);

  const review = buildReview({ snapshot, input, month, transactions, previous });
  const salary = snapshot.income.find((i) => i.type === 'salary');

  const [year, mon] = month.slice(0, 7).split('-').map(Number);
  const prevMonth = new Date(year, mon - 2, 1);
  const nextMonth = new Date(year, mon, 1);
  const href = (d: Date) =>
    `/review?month=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const overspent = review.totals.delta > 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[30px] leading-none">Review</h1>
            <PageGuide guide="review" />
          </div>
          <p className="mt-3 max-w-prose text-[15px] text-ink-soft">
            Projections run on your budget. Once a month you check that against
            what actually happened — this is the step that stops the model
            drifting away from your life.
          </p>
        </div>

        <nav className="flex items-center gap-2 text-[14px]" aria-label="Month">
          <Link
            href={href(prevMonth)}
            className="border border-line-strong px-2.5 py-1.5 text-ink-soft transition-all duration-[140ms] hover:border-accent hover:text-accent"
            aria-label={`Go to ${monthLabelOf(prevMonth)}`}
          >
            ←
          </Link>
          <span className="min-w-[7rem] text-center font-medium">
            {monthLabelOf(new Date(year, mon - 1, 1))}
          </span>
          <Link
            href={href(nextMonth)}
            className="border border-line-strong px-2.5 py-1.5 text-ink-soft transition-all duration-[140ms] hover:border-accent hover:text-accent"
            aria-label={`Go to ${monthLabelOf(nextMonth)}`}
          >
            →
          </Link>
        </nav>
      </header>

      {/* 1. Did the month go the way the plan said it would? */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Vital
            label="Planned surplus"
            value={inr(review.plannedSurplus)}
            sub={`${pct(review.inflow > 0 ? review.plannedSurplus / review.inflow : 0, 1)} of income`}
          />
          <Vital
            label="Actually left over"
            value={review.hasActuals ? inr(review.achievedSurplus) : '—'}
            sub={
              review.hasActuals
                ? `${inr(review.inflow)} in, ${inr(review.totals.actual)} logged out`
                : 'nothing logged this month'
            }
            tone={
              !review.hasActuals ? undefined : review.surplusDelta >= 0 ? 'good' : 'bad'
            }
            lead
          />
          <Vital
            label="Against plan"
            value={review.hasActuals ? inr(review.surplusDelta, { sign: true }) : '—'}
            sub={
              review.hasActuals
                ? review.surplusDelta >= 0
                  ? 'ahead of plan'
                  : 'behind plan'
                : 'log a few spends to compare'
            }
            tone={
              !review.hasActuals ? undefined : review.surplusDelta >= 0 ? 'good' : 'bad'
            }
          />
          <Vital
            label="Change in savings"
            value={
              review.corpusChange == null
                ? '—'
                : inr(review.corpusChange, { sign: true })
            }
            sub={
              previous
                ? `since ${monthLabelOf(new Date(previous.month))}`
                : 'no earlier record to compare against'
            }
            tone={
              review.corpusChange == null
                ? undefined
                : review.corpusChange >= 0
                  ? 'good'
                  : 'bad'
            }
          />
        </div>

      {/*
        2. Close out. This is the page's one verb, so it sits directly under the
        figures it records rather than at the bottom where it was living. Trends
        read these records, which is why editing a figure later cannot rewrite
        what a past month looked like.
      */}
      <Card title="Close out the month" icon={<IconCheck size={15} />} lead>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-prose text-[14px] text-ink-soft">
            {stored ? (
              <>
                Recorded: <Money amount={Number(stored.corpus)} compact /> savings ·{' '}
                <Money amount={Number(stored.net_worth)} compact /> net worth ·{' '}
                <Money amount={Number(stored.surplus)} /> surplus ·{' '}
                {pct(Number(stored.savings_rate), 1)} savings rate
              </>
            ) : (
              'No record for this month yet. Recording it is what gives the net worth trend a second point to draw.'
            )}
          </p>
          <form action={closeOutMonth}>
            <Button type="submit" variant={stored ? 'ghost' : 'primary'}>
              {stored ? 'Re-record this month' : 'Record this month'}
            </Button>
          </form>
        </div>
      </Card>

      {/* 3. Budget vs actual */}
      <Card
        title="Budget vs actual"
        icon={<IconExpenses size={15} />}
        hint="One-off spends are shown separately so they don’t skew future months"
        action={
          review.hasActuals ? (
            <span className={`text-[15px] font-semibold ${overspent ? 'text-bad' : 'text-good'}`}>
              {inr(review.totals.delta, { sign: true })}
            </span>
          ) : null
        }
      >
        {review.categories.length === 0 ? (
          <Empty>No budget lines yet. Add them on the expenses page.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-[15px]">
              <thead>
                <tr className="border-b border-line text-left text-[13px] uppercase tracking-wide text-ink-faint">
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 text-right font-medium">Budget</th>
                  <th className="py-2 pr-4 text-right font-medium">Actual</th>
                  <th className="py-2 pr-4 text-right font-medium">Variance</th>
                  <th className="py-2 text-right font-medium">Of which one-off</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {review.categories.map((line) => (
                  <tr key={line.category}>
                    <td className="py-2 pr-4 capitalize">{line.category}</td>
                    <td className="py-2 pr-4 text-[14px] text-ink-faint">
                      {line.type === 'uncategorised'
                        ? 'unbudgeted'
                        : line.type === 'fixed'
                          ? 'fixed'
                          : line.type === 'variable'
                            ? 'variable'
                            : 'savings'}
                    </td>
                    <td className="py-2 pr-4 text-right text-ink-soft">
                      <Money amount={line.budget} />
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {line.actual === 0 ? (
                        <span className="text-ink-faint">—</span>
                      ) : (
                        <Money amount={line.actual} />
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {line.actual === 0 ? (
                        <span className="text-ink-faint">—</span>
                      ) : (
                        <Money
                          amount={line.delta}
                          tone={line.delta > 0 ? 'bad' : 'good'}
                          sign
                        />
                      )}
                    </td>
                    <td className="py-2 text-right text-ink-faint">
                      {line.oneOff > 0 ? <Money amount={line.oneOff} /> : '—'}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-line-strong font-semibold">
                  <td className="py-2 pr-4">Total</td>
                  <td />
                  <td className="py-2 pr-4 text-right">
                    <Money amount={review.totals.budget} />
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <Money amount={review.totals.actual} />
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <Money
                      amount={review.totals.delta}
                      tone={review.totals.delta > 0 ? 'bad' : 'good'}
                      sign
                    />
                  </td>
                  <td className="py-2 text-right">
                    <Money amount={review.totals.oneOff} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 4. Goals on / off track */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="What you’re saving for"
          icon={<IconGoal size={15} />}
          hint="Where each one stands today"
        >
          {review.goals.length === 0 ? (
            <Empty>No goals yet.</Empty>
          ) : (
            <ul className="divide-y divide-line/70">
              {review.goals.map((goal) => (
                <li key={goal.goalId} className="flex items-start gap-3 py-3">
                  <span className="mt-1.5">
                    <TrafficLight tone={goal.onTrack ? 'good' : 'warn'} />
                  </span>
                  <div className="grow">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[15px] font-medium">{goal.name}</span>
                      <span className="tnum text-[14px] text-ink-soft">
                        {inr(goal.current, { compact: true })} /{' '}
                        {inr(goal.target, { compact: true })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[13px] text-ink-faint">
                      {goal.completionMonth == null
                        ? 'Not funded at this rate'
                        : `Ready by ${monthLabel(goal.completionMonth, anchor)}`}
                      {' · needs '}
                      {inr(goal.requiredMonthly)}/month
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 5. Wishlist movement */}
        <Card
          title="Wishlist"
          icon={<IconWishlist size={15} />}
          hint={
            previous
              ? 'Compared against last month’s recorded balance'
              : 'No earlier record, so no movement can be claimed'
          }
        >
          {review.wishlist.length === 0 ? (
            <Empty>No wishlist items to evaluate.</Empty>
          ) : (
            <ul className="divide-y divide-line/70">
              {review.wishlist.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Link
                    href={`/wishlist/${item.id}`}
                    className="text-[15px] font-medium hover:text-accent"
                  >
                    {item.name}
                  </Link>
                  {item.change === 'became-affordable' && (
                    <Pill tone="good">now affordable</Pill>
                  )}
                  {item.change === 'slipped' && (
                    <Pill tone="warn">slipped</Pill>
                  )}
                  <span className="ml-auto flex items-center gap-3">
                    <span className="text-[13px] text-ink-faint">
                      {item.affordableNow
                        ? item.delayMonths && item.delayMonths >= 0.05
                          ? `delays goals by ${item.delayMonths.toFixed(1)} months`
                          : 'no goal delay'
                        : item.waitMonths == null
                          ? 'blocked — resolve warnings first'
                          : item.waitMonths === 0
                            ? 'not affordable within a year'
                            : `wait ${item.waitMonths} months`}
                    </span>
                    <Money amount={item.price} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* 6. The one prompt that keeps the model honest */}
      <Card
        title="Anything changed?"
        icon={<IconEdit size={15} />}
        hint="A raise, a new bill, a corrected balance — update it here"
      >
        <form action={applyMonthlyCorrections} className="grid items-end gap-3 sm:grid-cols-3">
          {salary && <input type="hidden" name="salary_id" value={salary.id} />}
          <Field label="Net monthly salary">
            <Input
              name="net_salary"
              type="number"
              defaultValue={salary ? Number(salary.amount) : ''}
            />
          </Field>
          <Field label="Available savings">
            <Input
              name="liquid_corpus"
              type="number"
              defaultValue={Number(snapshot.profile.liquid_corpus)}
            />
          </Field>
          <div className="pb-1">
            <Button type="submit">Update</Button>
          </div>
          {snapshot.goals.map((goal) => (
            <Field key={goal.id} label={`${goal.name} balance`}>
              <Input
                name={`goal_current_${goal.id}`}
                type="number"
                defaultValue={Number(goal.current_amount)}
              />
            </Field>
          ))}
        </form>
        <p className="mt-4 text-[14px] text-ink-faint">
          Rent gone up? Subscription cancelled? Edit those on the{' '}
          <Link href="/expenses" className="text-accent">
            expenses page
          </Link>{' '}
          — set the date it changes from and past months stay as they were.
        </p>
      </Card>

      {/* 7. Actuals. Logging lives on the spending page — this is the read of
          it that the review needs, not a second place to type things in. */}
      <Card
        title="Transactions"
        icon={<IconSpending size={15} />}
        hint={`${transactions.length} logged this month`}
        action={
          <Link
            href={`/spending?month=${month.slice(0, 7)}`}
            className="text-[14px] text-accent"
          >
            Log spending
          </Link>
        }
      >
        {transactions.length === 0 && (
          <Empty>
            Nothing logged for this month.{' '}
            <Link
              href={`/spending?month=${month.slice(0, 7)}`}
              className="text-accent"
            >
              Add what you have spent
            </Link>{' '}
            — budget against actual needs both halves.
          </Empty>
        )}

        {transactions.length > 0 && (
          <ul className="mt-4 divide-y divide-line/70">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 py-2">
                <span className="tnum text-[14px] text-ink-faint">
                  {tx.date.slice(8, 10)}
                </span>
                <span className="text-[15px] capitalize">{tx.category}</span>
                {tx.is_one_off && <Pill tone="neutral">one-off</Pill>}
                {tx.note && (
                  <span className="text-[14px] text-ink-faint">{tx.note}</span>
                )}
                <span className="ml-auto flex items-center gap-3">
                  <Money amount={Number(tx.amount)} />
                  <form action={deleteTransaction}>
                    <input type="hidden" name="id" value={tx.id} />
                    {/*
                      Muted until you reach for it. Seven rows of red trash
                      icons read as seven warnings; the delete is incidental to
                      a list you came here to read.
                    */}
                    <button
                      type="submit"
                      aria-label={`Delete ${tx.category} ${inr(Number(tx.amount))}`}
                      className="cursor-pointer p-1 text-ink-faint/60 transition-colors duration-[140ms] hover:text-bad"
                    >
                      <IconTrash size={14} />
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}

      </Card>
    </div>
  );
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function Vital({
  label,
  value,
  sub,
  tone,
  lead,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'warn' | 'bad';
  lead?: boolean;
}) {
  const colour =
    tone === 'bad'
      ? 'text-bad'
      : tone === 'warn'
        ? 'text-warn'
        : tone === 'good'
          ? 'text-good'
          : 'text-ink';

  return (
    <div
      className={`rounded-2xl bg-surface p-5 ${
        lead ? 'border border-line border-t-2 border-t-accent' : 'border border-line'
      }`}
    >
      <div className="eyebrow">{label}</div>
      <div
        className={`tnum mt-2 ${lead ? 'font-display text-[28px] leading-none' : 'text-[20px] font-medium'} ${colour}`}
      >
        {value}
      </div>
      {sub && <p className="mt-2 text-[13px] leading-snug text-ink-faint">{sub}</p>}
    </div>
  );
}

function monthLabelOf(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

