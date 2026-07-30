import Link from 'next/link';
import { redirect } from 'next/navigation';
import { loadSnapshot, loadTransactionsForMonth } from '@/lib/db/repository';
import { isSupabaseConfigured } from '@/lib/db/driver';
import { toEngineInput } from '@/lib/model/to-engine';
import { healthSnapshot, simulate } from '@/lib/engine';
import { ensureMonthlySnapshot } from '@/lib/snapshot';
import { resumePath } from '@/lib/onboarding';
import { inr, monthLabel } from '@/lib/format';
import { balanceRows, monthlyBalance } from '@/lib/model/balance';
import { buildActuals, budgetsByCategory } from '@/lib/model/actuals';
import { monthKey, monthTitle } from '@/lib/model/spending';
import { cardDues, type CardDue } from '@/lib/model/cards';
import { Bar, Card, Empty, Money, Pill, TrafficLight } from '@/components/ui';
import { balanceTone } from '@/components/balance-strip';
import { NetWorthTrend } from '@/components/trend';
import {
  IconAlert,
  IconArrowRight,
  IconClock,
  IconGoal,
  IconSpending,
} from '@/components/icons';
import { PageGuide } from '@/components/page-guide';
import { now as clockNow } from '@/lib/clock';

export const dynamic = 'force-dynamic';

/**
 * The dashboard answers three questions, in this order, and nothing else:
 *
 *   1. What is left this month?            — the hero, one figure
 *   2. Is anything wrong?                  — attention, and only when there is
 *   3. Where is it going?                  — cashflow, goals, the year ahead
 *
 * The previous version opened with four equally-weighted cards and eleven
 * numbers competing, which is a report, not a dashboard. Everything below the
 * hero is now either an exception that needs a decision or a detail you go
 * looking for.
 */
export default async function DashboardPage() {
  const snapshot = await loadSnapshot();

  // Nothing here means anything without income and a balance, so a new account
  // goes straight to the sequence — and back to the step it stopped at, not to
  // the beginning of questions it has already answered.
  if (!snapshot.profile.setup_complete) redirect(resumePath(snapshot.profile));

  // Keeps this month’s row current, so trends have history to read instead of
  // recomputing the past.
  const written = await ensureMonthlySnapshot(snapshot);
  if (written.row) {
    const at = snapshot.snapshots.findIndex((s) => s.id === written.row!.id);
    if (at >= 0) snapshot.snapshots[at] = written.row;
    else snapshot.snapshots.push(written.row);
  }

  const { input, anchor } = toEngineInput(snapshot);
  const health = healthSnapshot(input);
  const result = simulate(input);
  const balance = monthlyBalance(snapshot);

  const month = monthKey();
  const transactions = await loadTransactionsForMonth(`${month}-01`);
  const actuals = buildActuals({
    transactions,
    budgets: budgetsByCategory(snapshot.expenses, month),
    month,
  });
  const projectedBalance = balance.balance - actuals.delta;
  const dues = cardDues(snapshot.cards, transactions, snapshot.expenses);

  const behind = result.goals.filter((goal) => goal.missedDeadline);

  return (
    <div className="space-y-10">
      {!isSupabaseConfigured && <LocalModeBanner />}

      <NextSteps
        hasExpenses={snapshot.expenses.length > 0}
        hasGoals={snapshot.goals.length > 0}
        hasWishlist={snapshot.wishlist.length > 0}
      />

      {/* 1. The figure everything else is measured against. */}
      <Hero balance={balance} health={health} />

      {/* 2. Only what needs a decision. Silent when there is nothing. */}
      <Attention
        breaches={result.breaches.slice(0, 3)}
        behindCount={behind.length}
        anchor={anchor}
        floorHeadroom={health.floorHeadroom}
      />

      {/* 3a. How the month in progress is actually going. Logging itself lives
          in the header, reachable from every page rather than this one. */}
      <section className="border border-line bg-surface">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line px-5 py-3.5">
          <h2 className="eyebrow flex items-center gap-2">
            <IconSpending size={14} />
            {monthTitle(month)} so far
          </h2>
          <Link
            href="/spending"
            className="inline-flex items-center gap-1 text-[12px] text-ink-faint transition-colors hover:text-accent"
          >
            Open the log
            <IconArrowRight size={13} />
          </Link>
        </div>

        <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          <Cell label="Logged" value={inr(actuals.logged)} sub={`${transactions.length} ${transactions.length === 1 ? 'entry' : 'entries'}`} />
          <Cell label="Budgeted" value={inr(actuals.budgeted)} sub="what the month should cost" />
          <Cell
            label="Heading for"
            value={inr(actuals.projected)}
            sub={
              actuals.delta > 0
                ? `${inr(actuals.delta)} over budget`
                : `${inr(Math.abs(actuals.delta))} under budget`
            }
            tone={actuals.delta > 0 ? 'bad' : undefined}
          />
          <Cell
            label="Balance if this holds"
            value={inr(projectedBalance)}
            sub={
              actuals.coverage.total === 0 && !actuals.hasLogs
                ? 'no budget line active yet'
                : !actuals.hasLogs
                  ? 'nothing logged, so this is your budget'
                  : `${actuals.coverage.logged}/${actuals.coverage.total} categories logged; rest at budget`
            }
            tone={projectedBalance < 0 ? 'bad' : actuals.delta > 0 ? 'warn' : 'good'}
            lead
          />
        </div>
      </section>

      {/* 3b. Where the money goes, and what it is building. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card
          title="Monthly cashflow"
          hint="This month as it is actually paid: a renewal lands whole in the month it renews, a bonus in the month it arrives"
          lead
        >
          <dl>
            {balanceRows(balance).map((row) => {
              const subtotal = row.kind === 'subtotal';
              const final = row.label === 'Balance left';
              return (
                <div
                  key={row.label}
                  className={`flex items-baseline justify-between gap-4 py-2 ${
                    subtotal ? 'border-t border-line font-semibold' : ''
                  } ${final ? 'mt-1 border-t-line-strong text-[15px]' : ''}`}
                >
                  <dt className={subtotal ? '' : 'text-[14px] text-ink-soft'}>
                    {row.label}
                  </dt>
                  <dd>
                    <Money
                      amount={row.amount}
                      tone={
                        final
                          ? row.amount >= 0
                            ? 'good'
                            : 'bad'
                          : subtotal
                            ? 'neutral'
                            : 'neutral'
                      }
                    />
                  </dd>
                </div>
              );
            })}
          </dl>
        </Card>

        <div className="space-y-6">
          <Card
            title="Goals"
            icon={<IconGoal size={14} />}
            hint="Funded in priority order"
            action={
              <Link
                href="/goals"
                className="inline-flex items-center gap-1 text-[12px] text-ink-faint transition-colors hover:text-accent"
              >
                Manage
                <IconArrowRight size={13} />
              </Link>
            }
          >
            {result.goals.length === 0 ? (
              <Empty>
                No goals yet.{' '}
                <Link href="/goals" className="text-accent">
                  Add one
                </Link>{' '}
                — purchases are measured against them.
              </Empty>
            ) : (
              <ul className="space-y-4">
                {result.goals.map((goal) => {
                  const config = input.goals!.find((g) => g.id === goal.goalId)!;
                  return (
                    <li key={goal.goalId}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="flex items-center gap-2 text-[14px]">
                          {goal.name}
                          {config.isProtected && <Pill tone="accent">protected</Pill>}
                        </span>
                        <span className="tnum text-[13px] text-ink-soft">
                          {inr(config.current, { compact: true })} /{' '}
                          {inr(goal.target, { compact: true })}
                        </span>
                      </div>
                      <div className="mt-2">
                        <Bar
                          value={config.current}
                          max={goal.target}
                          tone={goal.missedDeadline ? 'warn' : 'accent'}
                        />
                      </div>
                      <p className="mt-1.5 text-[12px] text-ink-faint">
                        {goal.completionMonth == null
                          ? `Not funded within ${result.horizonMonths} months`
                          : `Ready by ${monthLabel(goal.completionMonth, anchor)}`}
                        {goal.deadlineMonth != null &&
                          ` · target ${monthLabel(goal.deadlineMonth, anchor)}`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card
            title="Due in 30 days"
            icon={<IconClock size={14} />}
          >
            <Commitments snapshot={snapshot} dues={dues} />
          </Card>
        </div>
      </div>

      <Card
        title="The year ahead"
        hint="Committed items only. The first bar is the month the balance above describes."
      >
        <Projection
          result={result}
          anchor={anchor}
          floor={input.emergencyFloor}
          start={input.startCorpus}
        />
      </Card>

      <NetWorthTrend snapshots={snapshot.snapshots} />
    </div>
  );
}

/**
 * The hero. One figure at display size, its arithmetic spelled out beneath it,
 * and the three vitals as hairline-separated columns rather than four more
 * boxes — a card around a single number is a box for the sake of a box.
 */
function Hero({
  balance,
  health,
}: {
  balance: ReturnType<typeof monthlyBalance>;
  health: ReturnType<typeof healthSnapshot>;
}) {
  const tone = balanceTone(balance);
  const toneClass =
    tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-good';

  return (
    <section className="border-t-2 border-t-accent bg-surface">
      <div className="grid gap-px bg-line lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="bg-surface p-6 sm:p-8">
          <div className="flex items-center gap-2.5">
            <h1 className="eyebrow">Balance left each month</h1>
            <PageGuide guide="dashboard" compact />
          </div>
          <p
            className={`tnum font-display mt-3 text-[44px] leading-none sm:text-[56px] ${toneClass}`}
          >
            {inr(balance.balance)}
          </p>

          <dl className="mt-6 flex flex-wrap items-baseline gap-x-5 gap-y-2 text-[13px] text-ink-faint">
            <Term label="Income" value={balance.income} />
            <Op />
            <Term label="Expenses" value={balance.expenses} />
            {balance.loanEmis > 0 && (
              <>
                <Op />
                <Term label="EMIs" value={balance.loanEmis} />
              </>
            )}
            <Op />
            <Term label="Savings & goals" value={balance.savings} />
            {balance.wishlist > 0 && (
              <>
                <Op />
                <Term label="Wishlist" value={balance.wishlist} />
              </>
            )}
          </dl>

          {balance.notYetStarted > 0 && (
            <p className="mt-3 text-[12px] text-ink-faint">
              {inr(balance.notYetStarted)} of budget lines start later and are not
              counted yet.
            </p>
          )}

          {balance.notDueThisMonth > 0 && (
            <p className="mt-2 text-[12px] text-ink-faint">
              {inr(balance.notDueThisMonth)} of periodic bills are not due this
              month. A quiet month is roomier than the year is.
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-px bg-line lg:grid-cols-1">
          <Vital
            label="Savings"
            value={inr(health.liquidCorpus, { compact: true })}
            sub={
              health.floorHeadroom < 0
                ? `${inr(Math.abs(health.floorHeadroom), { compact: true })} under floor`
                : `${inr(health.floorHeadroom, { compact: true })} over floor`
            }
            tone={health.floorHeadroom < 0 ? 'bad' : undefined}
          />
          <Vital
            label="Runway"
            value={
              Number.isFinite(health.runwayMonths)
                ? `${health.runwayMonths.toFixed(1)}mo`
                : '∞'
            }
            sub={`at ${inr(health.monthlyBurn, { compact: true })} a month`}
          />
          <Vital
            label="Goals"
            value={
              health.goalHealth === 'good'
                ? 'On track'
                : health.goalHealth === 'warn'
                  ? 'At risk'
                  : 'Off track'
            }
            sub={health.goalHealthReason}
            tone={health.goalHealth === 'good' ? undefined : health.goalHealth}
          />
        </div>
      </div>
    </section>
  );
}

function Vital({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'warn' | 'bad';
}) {
  return (
    <div className="bg-surface p-5">
      <div className="eyebrow">{label}</div>
      <div
        className={`tnum mt-1.5 text-[19px] font-medium ${
          tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-ink'
        }`}
      >
        {value}
      </div>
      <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink-faint">{sub}</p>
    </div>
  );
}

function Term({ label, value }: { label: string; value: number }) {
  return (
    <span>
      {label} <span className="tnum text-ink-soft">{inr(value)}</span>
    </span>
  );
}

function Op() {
  return (
    <span aria-hidden className="text-ink-faint/50">
      −
    </span>
  );
}

function Cell({
  label,
  value,
  sub,
  tone,
  lead,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'warn' | 'bad' | 'good';
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
    <div className={`bg-surface p-5 ${lead ? 'border-t-2 border-t-accent' : ''}`}>
      <div className="eyebrow text-[10px]">{label}</div>
      <div className={`tnum mt-2 text-[20px] font-medium ${colour}`}>{value}</div>
      <p className="mt-1.5 text-[12px] leading-snug text-ink-faint">{sub}</p>
    </div>
  );
}

/**
 * Exceptions only. A dashboard that always shows a "warnings" panel teaches you
 * to stop reading it, so this renders nothing at all when nothing is wrong.
 */
function Attention({
  breaches,
  behindCount,
  anchor,
  floorHeadroom,
}: {
  breaches: ReturnType<typeof simulate>['breaches'];
  behindCount: number;
  anchor: Date;
  floorHeadroom: number;
}) {
  const items: { tone: 'warn' | 'bad'; text: string; href: string }[] = [];

  if (floorHeadroom < 0) {
    items.push({
      tone: 'bad',
      text: `Savings are ${inr(Math.abs(floorHeadroom))} below your emergency floor.`,
      href: '/setup',
    });
  }
  if (behindCount > 0) {
    items.push({
      tone: 'warn',
      text:
        behindCount === 1
          ? 'One goal will not land by its target date.'
          : `${behindCount} goals will not land by their target dates.`,
      href: '/goals',
    });
  }
  for (const breach of breaches) {
    items.push({
      tone: breach.severity === 'red' ? 'bad' : 'warn',
      text: `${breach.message} (${monthLabel(breach.month, anchor)})`,
      href: '/wishlist',
    });
  }

  if (items.length === 0) return null;

  return (
    <section className="border border-line bg-surface">
      <h2 className="eyebrow flex items-center gap-2 border-b border-line px-5 py-3">
        <IconAlert size={14} />
        Needs a decision
      </h2>
      <ul className="stagger divide-y divide-line">
        {items.slice(0, 4).map((item) => (
          <li key={item.text}>
            <Link
              href={item.href}
              className="flex items-start gap-3 px-5 py-3 transition-colors duration-[140ms] hover:bg-surface-lift"
            >
              <span className="mt-1.5">
                <TrafficLight tone={item.tone} />
              </span>
              <span className="text-[14px] text-ink-soft">{item.text}</span>
              <IconArrowRight
                size={15}
                className="ml-auto mt-0.5 shrink-0 text-ink-faint"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
function NextSteps({
  hasExpenses,
  hasGoals,
  hasWishlist,
}: {
  hasExpenses: boolean;
  hasGoals: boolean;
  hasWishlist: boolean;
}) {
  const steps = [
    {
      done: hasExpenses,
      href: '/expenses',
      label: 'Add what your month costs',
      why: 'Rent, food, subscriptions — this is what the balance is left over from.',
    },
    {
      done: hasGoals,
      href: '/goals',
      label: 'Set one goal',
      why: 'An emergency fund is the usual first. Purchases are measured against it.',
    },
    {
      done: hasWishlist,
      href: '/wishlist',
      label: 'Add something you want',
      why: 'The question the app exists to answer: what does buying it cost you in time?',
    },
  ];

  if (steps.every((step) => step.done)) return null;
  const remaining = steps.filter((step) => !step.done).length;

  return (
    <Card
      title="Finish setting up"
      hint={`${steps.length - remaining} of ${steps.length} done — the numbers below stay thin until all three are in`}
    >
      <ul className="space-y-3">
        {steps.map((step) => (
          <li key={step.href} className="flex items-start gap-3">
            <span
              aria-hidden
              className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                step.done
                  ? 'border-good bg-good-soft text-good'
                  : 'border-line text-ink-faint'
              }`}
            >
              {step.done ? '✓' : ''}
            </span>
            <span>
              {step.done ? (
                <span className="text-[14px] text-ink-faint line-through">
                  {step.label}
                </span>
              ) : (
                <Link href={step.href} className="text-[14px] font-medium text-accent">
                  {step.label} →
                </Link>
              )}
              {!step.done && (
                <span className="mt-0.5 block text-[13px] text-ink-faint">
                  {step.why}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

interface YearMonth {
  month: number;
  label: string;
  inflow: number;
  /** Everything that leaves: same arithmetic as the cashflow card. */
  out: number;
  goals: number;
  buffer: number;
  corpus: number;
}

/** One month worth saying something about, and why. */
interface Note {
  row: YearMonth;
  tone: 'bad' | 'warn' | 'accent';
  text: string;
}

/**
 * Twelve months, without twelve rows of the same number.
 *
 * The table this replaced was six columns by twelve rows — seventy-two figures
 * for a year that, for most people, is eleven identical months and one that
 * isn't. So the shape goes in a bar strip, the three numbers anyone actually
 * quotes go on top, and prose is spent only on the months that differ. The full
 * table is still here, one disclosure away, for when you want to audit it.
 */
function Projection({
  result,
  anchor,
  floor,
  start,
}: {
  result: ReturnType<typeof simulate>;
  anchor: Date;
  floor: number;
  start: number;
}) {
  const rows: YearMonth[] = result.months.slice(0, 12).map((m) => ({
    month: m.month,
    label: monthLabel(m.month, anchor),
    inflow: m.inflow,
    out: m.fixed + m.variable + m.loanEmis + m.investments + m.purchaseEmis,
    goals: m.goals.reduce((sum, g) => sum + g.required, 0),
    buffer: m.buffer,
    corpus: m.corpus,
  }));

  if (rows.length === 0) return <Empty>Nothing committed to project yet.</Empty>;

  const last = rows.at(-1)!;
  const added = last.corpus - start;
  const tightest = rows.reduce((a, b) => (b.buffer < a.buffer ? b : a));
  const fundedInYear = result.goals.filter(
    (g) => g.completionMonth != null && g.completionMonth <= rows.length,
  );

  // The median, not the mean: one annual insurance bill should stand out
  // against a usual month, not quietly redefine what usual means.
  const outs = rows.map((r) => r.out).sort((a, b) => a - b);
  const typicalOut = outs[Math.floor(outs.length / 2)];

  const notes = rows.flatMap<Note>((r) => {
    const done = result.goals.filter(
      (g) => g.completionMonth != null && Math.ceil(g.completionMonth) === r.month,
    );
    if (r.buffer < 0)
      return [
        { row: r, tone: 'bad' as const, text: `${inr(Math.abs(r.buffer))} short — the month does not clear` },
      ];
    if (r.corpus < floor)
      return [
        { row: r, tone: 'bad' as const, text: `savings sit under the ${inr(floor, { compact: true })} floor` },
      ];
    // 10% and ₹500 together, so a rounding wobble on a small budget is not a
    // headline and a real quarterly bill always is.
    if (r.out > typicalOut * 1.1 + 500)
      return [
        {
          row: r,
          tone: 'warn' as const,
          text: `${inr(r.out - typicalOut)} more goes out than a usual month`,
        },
      ];
    if (done.length > 0)
      return [
        {
          row: r,
          tone: 'accent' as const,
          text: `${done.map((g) => g.name).join(' and ')} funded`,
        },
      ];
    return [];
  });

  return (
    <div>
      <div className="grid gap-px border border-line bg-line sm:grid-cols-3">
        <Cell
          label={`Savings by ${last.label}`}
          value={inr(last.corpus, { compact: true })}
          sub={`${inr(added, { compact: true, sign: true })} over ${rows.length} months`}
          tone={last.corpus < floor ? 'bad' : undefined}
        />
        <Cell
          label="Tightest month"
          value={inr(tightest.buffer)}
          sub={
            tightest.buffer < 0
              ? `${tightest.label} — that much short`
              : `${tightest.label} — still left over after everything`
          }
          tone={tightest.buffer < 0 ? 'bad' : undefined}
        />
        <Cell
          label="Goals reached"
          value={
            result.goals.length === 0
              ? '—'
              : `${fundedInYear.length} of ${result.goals.length}`
          }
          sub={
            result.goals.length === 0
              ? 'no goals set yet'
              : fundedInYear.length === 0
                ? 'none hit their target inside the year'
                : fundedInYear.map((g) => g.name).join(', ')
          }
        />
      </div>

      <YearStrip rows={rows} floor={floor} />

      {notes.length === 0 ? (
        <p className="mt-5 max-w-prose text-[13px] text-ink-soft">
          Every month looks like the one before it: {inr(rows[0].buffer)} left
          after everything, nothing lumpy, nothing short.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-line border-t border-line">
          {notes.map((n) => (
            <li
              key={n.row.month}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 text-[14px]"
            >
              <span className="w-[76px] shrink-0 text-ink-soft">{n.row.label}</span>
              <span className={n.tone === 'bad' ? 'text-bad' : n.tone === 'warn' ? 'text-warn' : 'text-ink-soft'}>
                {n.text}
              </span>
            </li>
          ))}
        </ul>
      )}

      <details className="group mt-5 border-t border-line pt-3">
        <summary className="cursor-pointer list-none text-[12px] uppercase tracking-[0.06em] text-ink-faint transition-colors hover:text-accent">
          Month by month
          <span className="ml-1.5 inline-block transition-transform group-open:rotate-90" aria-hidden>
            ›
          </span>
        </summary>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-[14px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] uppercase tracking-wide text-ink-faint">
                <th className="py-2 pr-4 font-medium">Month</th>
                <th className="py-2 pr-4 text-right font-medium">Income</th>
                <th className="py-2 pr-4 text-right font-medium">Out</th>
                <th className="py-2 pr-4 text-right font-medium">Goals</th>
                <th className="py-2 pr-4 text-right font-medium">Balance left</th>
                <th className="py-2 text-right font-medium">Savings balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.month}>
                  <td className="py-2 pr-4 text-ink-soft">{r.label}</td>
                  <td className="py-2 pr-4 text-right">
                    <Money amount={r.inflow} />
                  </td>
                  <td className="py-2 pr-4 text-right text-ink-soft">
                    <Money amount={r.out} />
                  </td>
                  <td className="py-2 pr-4 text-right text-ink-soft">
                    {r.goals === 0 ? (
                      <span className="text-ink-faint">—</span>
                    ) : (
                      <Money amount={r.goals} />
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <Money amount={r.buffer} tone={r.buffer < 0 ? 'bad' : 'neutral'} />
                  </td>
                  <td className="py-2 text-right">
                    <Money
                      amount={r.corpus}
                      tone={r.corpus < floor ? 'bad' : 'neutral'}
                      compact
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-3 max-w-prose text-[13px] text-ink-faint">
            Savings balance grows by more than the balance left, because goal
            money is still your money — it sits inside the same pot, earmarked. A
            month where a half-yearly or annual bill lands shows the whole bill in{' '}
            <em>out</em>, which is also what the header does for the month it is
            quoting — the two agree.
          </p>
        </div>
      </details>
    </div>
  );
}

/**
 * The savings balance as twelve columns. Bars, not the area chart used for net
 * worth below, because this is a forecast of discrete months rather than a
 * recorded line — and two area charts on one page read as one repeated twice.
 */
function YearStrip({ rows, floor }: { rows: YearMonth[]; floor: number }) {
  const corpuses = rows.map((r) => r.corpus);
  const hi = Math.max(...corpuses);
  // A projection can dip below zero while a loan is being cleared, so the
  // baseline is the lower of zero and the worst month rather than always zero.
  const base = Math.min(0, ...corpuses);
  const span = hi - base || 1;
  const height = (v: number) => Math.max(2, ((v - base) / span) * 100);
  const floorAt = floor > base && floor < hi ? ((floor - base) / span) * 100 : null;

  return (
    <figure className="m-0 mt-5">
      <div className="relative flex h-24 items-end gap-[3px]" role="presentation">
        {floorAt != null && (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line-strong"
            style={{ bottom: `${floorAt}%` }}
          />
        )}
        {rows.map((r) => (
          <div
            key={r.month}
            className="group relative flex-1"
            style={{ height: `${height(r.corpus)}%` }}
            title={`${r.label} · savings ${inr(r.corpus)} · ${inr(r.buffer)} left that month`}
          >
            <div
              className={`h-full w-full transition-colors duration-[140ms] ${
                r.corpus < floor || r.buffer < 0
                  ? 'bg-bad'
                  : 'bg-accent/35 group-hover:bg-accent'
              }`}
            />
          </div>
        ))}
      </div>

      <div className="mt-1.5 flex gap-[3px]">
        {rows.map((r) => (
          <span
            key={r.month}
            className="flex-1 text-center text-[10px] tracking-tight text-ink-faint"
          >
            {r.label.slice(0, 3)}
          </span>
        ))}
      </div>

      <figcaption className="sr-only">
        Savings balance from {inr(rows[0].corpus)} in {rows[0].label} to{' '}
        {inr(rows.at(-1)!.corpus)} in {rows.at(-1)!.label}.
      </figcaption>
    </figure>
  );
}

function Commitments({
  snapshot,
  dues,
}: {
  snapshot: Awaited<ReturnType<typeof loadSnapshot>>;
  dues: CardDue[];
}) {
  const today = clockNow();
  const items = [
    ...snapshot.loans
      // A loan drawn down in January owes nothing in July: its due day exists,
      // but the loan does not yet.
      .filter(
        (l) =>
          Number(l.emi) > 0 &&
          new Date(l.start_date) <= today &&
          l.tenure_months > 0,
      )
      .map((l) => ({
        name: l.name,
        amount: Number(l.emi),
        days: daysAway(l.due_day, today),
        kind: 'EMI',
        href: '/loans',
      })),
    // The statemented bill, not a number someone typed months ago.
    ...dues
      .filter((due) => due.closed.total > 0)
      .map((due) => ({
        name: due.card.name,
        amount: due.closed.total,
        days: due.daysToDue,
        kind: 'Card bill',
        href: '/cards',
      })),
  ]
    .filter((item) => item.days <= 30)
    .sort((a, b) => a.days - b.days);

  if (items.length === 0) return <Empty>Nothing due in the next 30 days.</Empty>;

  return (
    <ul className="divide-y divide-line">
      {items.map((item, i) => (
        <li key={`${item.name}-${i}`}>
          <Link
            href={item.href}
            className="flex items-baseline justify-between gap-4 py-2.5 transition-colors duration-[140ms] hover:bg-surface-lift"
          >
            <span className="text-[14px]">
              {item.name}
              <span className="ml-2 text-[11px] uppercase tracking-[0.06em] text-ink-faint">
                {item.kind}
              </span>
            </span>
            <span className="flex items-baseline gap-3">
              <span
                className={
                  item.days < 0
                    ? 'text-[12px] text-bad'
                    : item.days <= 5
                      ? 'text-[12px] text-warn'
                      : 'text-[12px] text-ink-faint'
                }
              >
                {item.days < 0
                  ? `${Math.abs(item.days)}d late`
                  : `in ${item.days}d`}
              </span>
              <Money amount={item.amount} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function daysAway(day: number, today: Date): number {
  const current = today.getDate();
  if (day >= current) return day - current;
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return daysInMonth - current + day;
}

function LocalModeBanner() {
  return (
    <div className="rounded-xl border border-line bg-warn-soft px-4 py-3 text-[13px] text-warn">
      Running on the local JSON store (<code>.wishit/data.json</code>). Set{' '}
      <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
      <code>SUPABASE_SERVICE_ROLE_KEY</code> to switch to Supabase — see{' '}
      <code>README.md</code>.
    </div>
  );
}

