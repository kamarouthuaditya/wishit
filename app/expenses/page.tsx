import Link from 'next/link';
import { loadReadySnapshot } from '@/lib/db/repository';
import { deleteExpense, saveExpense, seedDefaultExpenses } from '@/lib/actions';
import { toEngineInput } from '@/lib/model/to-engine';
import { planningTotals } from '@/lib/engine';
import { monthlyBalance } from '@/lib/model/balance';
import { inr } from '@/lib/format';
import { Button, Field, Input, Money, Select } from '@/components/ui';
import { ExpenseComposer } from '@/components/expense-composer';
import { IconCard, IconClock, IconEdit } from '@/components/icons';
import { ConfirmButton } from '@/components/confirm-button';
import { PageGuide } from '@/components/page-guide';
import type { ExpenseItemRow } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

const FREQUENCIES = [
  { value: '1', label: 'Monthly' },
  { value: '3', label: 'Quarterly' },
  { value: '6', label: 'Half-yearly' },
  { value: '12', label: 'Yearly' },
];

/**
 * The budget, as a list you read rather than a page of forms you fill in.
 *
 * Every line used to be an open form with its own Save button: seven lines meant
 * seven forms, forty controls, and no way to see at a glance what the month
 * costs. Now a line is a row — name, category, what it works out to per month —
 * and editing is a disclosure on the row that needs it. Adding, the thing you
 * actually came for, is pinned to the bottom of the screen.
 */
export default async function ExpensesPage() {
  const snapshot = await loadReadySnapshot();
  const { input } = toEngineInput(snapshot);
  const plan = planningTotals(input);
  const balance = monthlyBalance(snapshot);

  const groups = [
    {
      type: 'fixed' as const,
      title: 'Fixed',
      hint: 'Same every month: rent, insurance, subscriptions',
      total: plan.fixed,
    },
    {
      type: 'variable' as const,
      title: 'Variable',
      hint: 'Budgets you spend against: food, petrol, shopping',
      total: plan.variable,
    },
  ];

  const categories = [
    ...new Set([
      ...snapshot.expenses.map((e) => e.category),
      'housing', 'food', 'transport', 'utilities', 'health', 'lifestyle',
      'family', 'insurance', 'fitness',
    ]),
  ].sort();

  return (
    <div className="space-y-8 pb-28">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[30px] leading-none">Expenses</h1>
            <PageGuide guide="expenses" />
          </div>
          <p className="mt-3 max-w-prose text-[14px] text-ink-soft">
            What your month costs, before anything is saved. This is the budget;
            what actually leaves is whatever you log on the{' '}
            <Link href="/spending" className="text-accent">
              spending page
            </Link>
            .
          </p>
        </div>

        <dl className="flex items-end gap-px border border-line bg-line">
          <Total label="Fixed" value={plan.fixed} />
          <Total label="Variable" value={plan.variable} />
          <Total label="Total" value={plan.fixed + plan.variable} lead />
        </dl>
      </header>

      {balance.notYetStarted > 0 && (
        <p className="flex items-center gap-2 border border-line px-4 py-3 text-[13px] text-ink-faint">
          <IconClock size={15} />
          {inr(balance.notYetStarted)} a month of lines start later and are not in
          the balance yet.
        </p>
      )}

      {snapshot.expenses.length === 0 && (
        <div className="border border-dashed border-line px-5 py-8 text-center">
          <p className="text-[15px] text-ink-soft">
            Nothing here yet. Add lines below, or start from a typical month.
          </p>
          <form action={seedDefaultExpenses} className="mt-4">
            <Button variant="ghost" type="submit">
              Pre-fill typical expenses
            </Button>
          </form>
        </div>
      )}

      {groups.map((group) => {
        const rows = snapshot.expenses.filter((e) => e.type === group.type);
        if (rows.length === 0) return null;

        return (
          <section key={group.type}>
            <div className="flex items-baseline justify-between gap-4 border-b border-line-strong pb-2">
              <div>
                <h2 className="eyebrow">{group.title}</h2>
                <p className="mt-1 text-[13px] text-ink-faint">{group.hint}</p>
              </div>
              <p className="tnum text-[15px] font-semibold">
                <Money amount={group.total} />
                <span className="ml-1 text-[11px] font-normal text-ink-faint">
                  /mo
                </span>
              </p>
            </div>

            <ul className="divide-y divide-line">
              {rows.map((row) => (
                <ExpenseRow
                  key={row.id}
                  row={row}
                  cards={snapshot.cards}
                  categories={categories}
                />
              ))}
            </ul>
          </section>
        );
      })}

      <ExpenseComposer cards={snapshot.cards} categories={categories} />
    </div>
  );
}

function Total({
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
        {inr(value)}
      </dd>
    </div>
  );
}

/**
 * A row reads; the form is one disclosure away. `<details>` rather than state so
 * this stays a server component and works with JavaScript off.
 */
function ExpenseRow({
  row,
  cards,
  categories,
}: {
  row: ExpenseItemRow;
  cards: { id: string; name: string }[];
  categories: string[];
}) {
  const every = Math.max(1, row.frequency_months ?? 1);
  const monthly = Number(row.amount) / every;
  const card = cards.find((c) => c.id === row.paid_by_card_id);

  return (
    <li className="group">
      <details >
        <summary className="flex cursor-pointer list-none items-baseline gap-4 py-3 transition-colors duration-[140ms] hover:bg-surface-lift">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px]">{row.name}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-ink-faint">
              <span>{row.category}</span>
              {every > 1 && (
                <span>
                  {inr(Number(row.amount))} every {every} months
                </span>
              )}
              {card && (
                <span className="inline-flex items-center gap-1">
                  <IconCard size={12} />
                  {card.name}
                </span>
              )}
            </span>
          </span>

          <span className="tnum shrink-0 text-[15px]">
            {inr(monthly)}
            <span className="ml-1 text-[11px] text-ink-faint">/mo</span>
          </span>

          <span className="shrink-0 text-ink-faint opacity-0 transition-opacity duration-[140ms] group-hover:opacity-100 group-focus-within:opacity-100">
            <IconEdit size={15} />
          </span>
        </summary>

        <form
          action={saveExpense}
          className="grid gap-4 border-t border-line bg-paper px-4 py-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="type" value={row.type} />

          <Field label="Name">
            <Input name="name" defaultValue={row.name} />
          </Field>
          <Field label="Category">
            <Input
              name="category"
              list="wishit-expense-categories"
              defaultValue={row.category}
            />
          </Field>
          <Field
            label="Amount per bill"
            hint={every > 1 ? `${inr(monthly)} a month` : undefined}
          >
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
          <Field label="Paid from">
            <Select name="paid_by_card_id" defaultValue={row.paid_by_card_id ?? ''}>
              <option value="">Bank account</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
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
          <Field label="Ends" hint="Blank means it keeps running">
            <Input
              name="effective_to"
              type="date"
              defaultValue={row.effective_to?.slice(0, 10) ?? ''}
            />
          </Field>

          <div className="flex items-end gap-2 pb-1">
            <Button type="submit">Save</Button>
            <ConfirmButton
              action={deleteExpense}
              id={row.id}
              confirm={`Delete ${row.name}? Past months keep it; the balance loses it.`}
            />
          </div>
        </form>
      </details>

      <datalist id="wishit-expense-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </li>
  );
}
