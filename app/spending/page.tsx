import Link from 'next/link';
import {
  loadReadySnapshot,
  loadTransactionMonths,
  loadTransactionsForMonth,
} from '@/lib/db/repository';
import { deleteTransaction, updateTransaction } from '@/lib/actions';
import {
  monthKey,
  monthTitle,
  shiftMonth,
  summariseMonth,
} from '@/lib/model/spending';
import { buildActuals, budgetsByCategory } from '@/lib/model/actuals';
import { LogForm } from '@/components/log-form';
import { inr, isoDate, pct } from '@/lib/format';
import { Bar, Button, Card, Empty, Field, Input, Money, Pill, Select } from '@/components/ui';
import { ConfirmButton } from '@/components/confirm-button';
import { PageGuide } from '@/components/page-guide';
import { IconCard, IconEdit } from '@/components/icons';
import type { TransactionRow } from '@/lib/db/types';
import { now as clockNow } from '@/lib/clock';

export const dynamic = 'force-dynamic';

/**
 * Module 7a — the spending log. "Where did the money actually go this month?"
 *
 * Standalone on purpose: it answers a question you have every day, while the
 * review answers one you have once a month. Nothing logged here changes a
 * projection — budgets plan, this records — so an entry can never be deducted
 * twice.
 */
export default async function SpendingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.month) ? params.month[0] : params.month;
  const now = clockNow();
  const month = /^\d{4}-\d{2}$/.test(raw ?? '') ? raw! : monthKey(now);

  const [snapshot, transactions, months] = await Promise.all([
    loadReadySnapshot(),
    loadTransactionsForMonth(`${month}-01`),
    loadTransactionMonths(),
  ]);

  const budgetLines = budgetsByCategory(snapshot.expenses, month);
  const budgets = new Map(
    [...budgetLines].map(([category, line]) => [category, line.amount]),
  );

  const summary = summariseMonth(transactions, { budgets, now, month });
  const actuals = buildActuals({ transactions, budgets: budgetLines, month, now });
  const isCurrentMonth = month === monthKey(now);
  const categoryOptions = [
    ...new Set([
      ...snapshot.expenses.map((e) => e.category),
      ...transactions.map((t) => t.category),
    ]),
  ].sort();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[30px] leading-none">Spending</h1>
            <PageGuide guide="spending" />
          </div>
          <p className="mt-3 max-w-prose text-[14px] text-ink-soft">
            Every rupee that actually left, day by day. A record, not a plan —
            logging here never moves your budget or the balance in the header.
            Compare the two on the{' '}
            <Link href="/review" className="text-accent">
              monthly review
            </Link>
            .
          </p>
        </div>
        <MonthNav month={month} months={months} isCurrentMonth={isCurrentMonth} />
      </header>

      <section className="border-t-2 border-t-accent bg-surface">
        <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          <Vital
            label={`Spent in ${monthTitle(month)}`}
            value={inr(summary.total)}
            sub={`${summary.count} ${summary.count === 1 ? 'entry' : 'entries'}`}
            lead
          />
          <Vital
            label="A day, on average"
            value={inr(summary.perDay)}
            sub={isCurrentMonth ? 'across the days so far' : 'across the whole month'}
          />
          <Vital
            label="Biggest day"
            value={summary.busiestDay ? inr(summary.busiestDay.total) : '—'}
            sub={summary.busiestDay ? dayLabel(summary.busiestDay.date) : 'nothing logged'}
          />
          <Vital
            label="One-offs"
            value={inr(summary.oneOff)}
            sub={
              summary.oneOff > 0
                ? `${inr(summary.routine)} was ordinary spending`
                : 'nothing marked unusual'
            }
            tone={summary.oneOff > 0 ? 'warn' : undefined}
          />
        </div>
      </section>

      <section className="border border-line bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="eyebrow">Log a spend</h2>
          <span className="text-[12px] text-ink-faint">
            Heading for <Money amount={actuals.projected} />
            {actuals.coverage.total > 0 &&
              ` · ${actuals.coverage.logged}/${actuals.coverage.total} categories logged`}
          </span>
        </div>
        <div className="mt-4">
          <LogForm
            categories={categoryOptions}
            defaultDate={isCurrentMonth ? isoDate() : `${month}-01`}
            cards={snapshot.cards}
            listId="wishit-spend-categories"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card title="Day by day" hint="Newest first">
          {summary.days.length === 0 ? (
            <Empty>
              Nothing logged for {monthTitle(month)} yet. Add the last thing you
              paid for.
            </Empty>
          ) : (
            <ul className="space-y-4">
              {summary.days.map((day) => (
                <li key={day.date}>
                  <div className="flex items-baseline justify-between border-b border-line pb-1.5">
                    <span className="text-[13px] font-medium">
                      {dayLabel(day.date)}
                    </span>
                    <span className="text-[13px] font-semibold">
                      <Money amount={day.total} />
                    </span>
                  </div>
                  <ul className="divide-y divide-line">
                    {day.rows.map((tx) => (
                      <EntryRow
                        key={tx.id}
                        tx={tx}
                        cards={snapshot.cards}
                        categories={categoryOptions}
                      />
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Where it went" hint="Against your budget, where you have one">
            {summary.categories.length === 0 ? (
              <Empty>No categories yet.</Empty>
            ) : (
              <ul className="space-y-3">
                {summary.categories.map((line) => {
                  const over = line.budget != null && line.total > line.budget;
                  return (
                    <li key={line.category}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[14px] capitalize">{line.category}</span>
                        <span className="text-[14px]">
                          <Money amount={line.total} tone={over ? 'bad' : 'neutral'} />
                          <span className="ml-2 text-[12px] text-ink-faint">
                            {pct(line.share, 0)}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <Bar
                          value={line.total}
                          max={Math.max(line.budget ?? 0, line.total)}
                          tone={line.budget == null ? 'neutral' : over ? 'bad' : 'accent'}
                        />
                      </div>
                      <p className="mt-1 text-[12px] text-ink-faint">
                        {line.budget == null
                          ? 'No budget line for this'
                          : over
                            ? `${inr(line.total - line.budget)} over the ${inr(line.budget)} budgeted`
                            : `${inr(line.budget - line.total)} left of ${inr(line.budget)}`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Export" hint="Your log, as a file you own">
            <div className="flex flex-wrap gap-3">
              <a
                href={`/spending/export?month=${month}`}
                download
                className="inline-flex items-center justify-center rounded-lg border border-line px-3.5 py-2 text-[14px] font-medium text-ink transition hover:bg-line/40"
              >
                {monthTitle(month)}
                {summary.count > 0 ? ` · ${summary.count}` : ''}
              </a>
              <a
                href="/spending/export"
                download
                className="inline-flex items-center justify-center rounded-lg border border-line px-3.5 py-2 text-[14px] font-medium text-ink transition hover:bg-line/40"
              >
                Everything
              </a>
            </div>
            <p className="mt-3 text-[13px] text-ink-faint">
              <code>date, amount, category, note, one_off</code> — opens in any
              spreadsheet, and takes your data with you if you ever leave.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Previous and next month, plus every month that has anything in it. */
function MonthNav({
  month,
  months,
  isCurrentMonth,
}: {
  month: string;
  months: string[];
  isCurrentMonth: boolean;
}) {
  const known = [...new Set([...months, month])].sort((a, b) => b.localeCompare(a));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/spending?month=${shiftMonth(month, -1)}`}
        className="rounded-lg border border-line px-2.5 py-1.5 text-[13px] hover:bg-line/40"
        aria-label="Previous month"
      >
        ←
      </Link>
      <span className="text-[14px] font-medium">{monthTitle(month)}</span>
      <Link
        href={`/spending?month=${shiftMonth(month, 1)}`}
        className="rounded-lg border border-line px-2.5 py-1.5 text-[13px] hover:bg-line/40"
        aria-label="Next month"
      >
        →
      </Link>
      {!isCurrentMonth && (
        <Link href="/spending" className="text-[13px] text-accent">
          This month
        </Link>
      )}
      {known.length > 1 && (
        <span className="flex flex-wrap gap-2 text-[12px] text-ink-faint">
          {known.slice(0, 6).map((m) => (
            <Link
              key={m}
              href={`/spending?month=${m}`}
              className={m === month ? 'text-ink' : 'hover:text-ink'}
            >
              {m}
            </Link>
          ))}
        </span>
      )}
    </div>
  );
}

function Vital({
  label,
  value,
  sub,
  tone,
  lead,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'warn' | 'bad';
  lead?: boolean;
}) {
  return (
    <div className="bg-surface p-5">
      <div className="eyebrow">{label}</div>
      <div
        className={`tnum mt-2 ${lead ? 'font-display text-[30px] leading-none' : 'text-[20px] font-medium'} ${
          tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-ink'
        }`}
      >
        {value}
      </div>
      <p className="mt-2 text-[12px] leading-snug text-ink-faint">{sub}</p>
    </div>
  );
}

/**
 * One logged spend. Correcting a typo used to mean deleting the row and
 * retyping it, so the row opens into the same fields it was created with —
 * including the card, which decides when the money actually leaves.
 */
function EntryRow({
  tx,
  cards,
  categories,
}: {
  tx: TransactionRow;
  cards: { id: string; name: string }[];
  categories: string[];
}) {
  const card = cards.find((c) => c.id === tx.paid_by_card_id);

  return (
    <li className="group">
      <details>
        <summary className="flex cursor-pointer list-none items-center gap-3 py-2.5 transition-colors duration-[140ms] hover:bg-surface-lift">
          <span className="text-[14px] capitalize">{tx.category}</span>
          {tx.is_one_off && <Pill tone="neutral">one-off</Pill>}
          {card && (
            <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
              <IconCard size={12} />
              {card.name}
            </span>
          )}
          {tx.note && (
            <span className="truncate text-[13px] text-ink-faint">{tx.note}</span>
          )}
          <span className="ml-auto flex items-center gap-3">
            <Money amount={Number(tx.amount)} />
            <span className="text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">
              <IconEdit size={14} />
            </span>
          </span>
        </summary>

        <form
          action={updateTransaction}
          className="grid gap-3 border-t border-line bg-paper px-3 py-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <input type="hidden" name="id" value={tx.id} />
          <Field label="Date">
            <Input name="date" type="date" defaultValue={tx.date.slice(0, 10)} />
          </Field>
          <Field label="Amount">
            <Input
              name="amount"
              type="number"
              step="1"
              defaultValue={Number(tx.amount)}
            />
          </Field>
          <Field label="Category">
            <Input
              name="category"
              list="wishit-spend-categories"
              defaultValue={tx.category}
            />
          </Field>
          <Field label="Note">
            <Input name="note" defaultValue={tx.note ?? ''} />
          </Field>
          {cards.length > 0 && (
            <Field label="Paid with">
              <Select name="paid_by_card_id" defaultValue={tx.paid_by_card_id ?? ''}>
                <option value="">Bank account</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <label className="flex items-center gap-2 pb-2 text-[13px]">
            <input
              type="checkbox"
              name="is_one_off"
              defaultChecked={tx.is_one_off}
              className="size-4 accent-[var(--accent)]"
            />
            One-off
          </label>
          <div className="flex items-end gap-2 pb-1">
            <Button type="submit" size="sm">Save</Button>
            <ConfirmButton
              action={deleteTransaction}
              id={tx.id}
              label="Delete"
              confirm={`Delete this ${tx.category} entry of ${inr(Number(tx.amount))}?`}
            />
          </div>
          <datalist id="wishit-spend-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </form>
      </details>
    </li>
  );
}

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
