import Link from 'next/link';
import { loadReadySnapshot } from '@/lib/db/repository';
import { driver } from '@/lib/db/driver';
import { deleteCard, saveCard } from '@/lib/actions';
import { cardDues, type CardDue } from '@/lib/model/cards';
import { inr } from '@/lib/format';
import { Bar, Button, Empty, Field, Input, Money, Pill } from '@/components/ui';
import { IconAlert, IconCard, IconClock, IconEdit } from '@/components/icons';
import { ConfirmButton } from '@/components/confirm-button';
import { PageGuide } from '@/components/page-guide';
import type { TransactionRow } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

/**
 * Cards, as dues.
 *
 * A card bill is money already spent that leaves on a date you did not choose,
 * which makes it the same kind of thing as an EMI. It is not an extra expense:
 * a ₹2,000 dinner on a card is the same ₹2,000 whether it leaves on Tuesday or
 * on the 5th of next month, so nothing here is charged to the budget twice.
 * What the card changes is the timing, and the timing is what this page shows.
 */
export default async function CardsPage() {
  const snapshot = await loadReadySnapshot();
  const transactions = await driver().list<TransactionRow>('transaction');
  const dues = cardDues(snapshot.cards, transactions, snapshot.expenses);

  const payable = dues.reduce((sum, due) => sum + due.closed.total, 0);
  const accruing = dues.reduce((sum, due) => sum + due.open.total, 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[30px] leading-none">Cards</h1>
            <PageGuide guide="cards" />
          </div>
          <p className="mt-3 max-w-prose text-[14px] text-ink-soft">
            What each card owes and when it falls due. Tag a spend to a card when
            you{' '}
            <Link href="/spending" className="text-accent">
              log it
            </Link>{' '}
            and it lands here instead of leaving your account that day.
          </p>
        </div>

        {snapshot.cards.length > 0 && (
          <dl className="flex items-end gap-px border border-line bg-line">
            <Figure label="Due now" value={payable} lead />
            <Figure label="Still accruing" value={accruing} />
          </dl>
        )}
      </header>

      {snapshot.cards.length === 0 ? (
        <Empty>
          No cards yet. Add one below to see what a statement is quietly building
          up to.
        </Empty>
      ) : (
        <ul className="space-y-px border border-line bg-line">
          {dues.map((due) => (
            <CardRow key={due.card.id} due={due} />
          ))}
        </ul>
      )}

      <section>
        <h2 className="eyebrow border-b border-line-strong pb-2">Add a card</h2>
        <form
          action={saveCard}
          className="grid gap-4 py-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <Field label="Name">
            <Input name="name" placeholder="HDFC Millennia" required />
          </Field>
          <Field label="Credit limit">
            <Input name="credit_limit" type="number" placeholder="200000" />
          </Field>
          <Field label="Statement day" hint="Day the bill is cut">
            <Input
              name="statement_day"
              type="number"
              min={1}
              max={31}
              defaultValue={1}
            />
          </Field>
          <Field label="Due day" hint="Day it must be paid">
            <Input name="due_day" type="number" min={1} max={31} defaultValue={20} />
          </Field>
          <div className="flex items-end pb-1">
            <Button type="submit">Add card</Button>
          </div>
        </form>
      </section>
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
        {inr(value)}
      </dd>
    </div>
  );
}

const DATE = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });

function CardRow({ due }: { due: CardDue }) {
  const { card, closed, open } = due;
  const limit = Number(card.credit_limit) || 0;
  const late = due.daysToDue < 0 && closed.total > 0;
  const soon = due.daysToDue >= 0 && due.daysToDue <= 5 && closed.total > 0;

  return (
    <li className="group bg-surface">
      <details>
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-3 p-5 transition-colors duration-[140ms] hover:bg-surface-lift">
          <span className="min-w-[10rem] flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <IconCard size={15} className="text-ink-faint" />
              <span className="text-[16px]">{card.name}</span>
              {late && <Pill tone="bad">overdue</Pill>}
              {soon && <Pill tone="warn">due soon</Pill>}
            </span>

            {limit > 0 && (
              <span className="mt-2.5 block max-w-xs">
                <Bar
                  value={closed.total}
                  max={limit}
                  tone={due.utilisation > 0.5 ? 'warn' : 'accent'}
                />
                <span className="mt-1.5 block text-[12px] text-ink-faint">
                  {inr(closed.total, { compact: true })} of{' '}
                  {inr(limit, { compact: true })} limit
                  {due.utilisation > 0.3 &&
                    ` · ${Math.round(due.utilisation * 100)}% used`}
                </span>
              </span>
            )}
          </span>

          <span className="text-right">
            <span className="eyebrow text-[10px]">Due {DATE.format(closed.due)}</span>
            <span className="tnum mt-1 block text-[19px]">
              <Money
                amount={closed.total}
                tone={late ? 'bad' : soon ? 'warn' : 'neutral'}
              />
            </span>
            <span className="mt-0.5 block text-[11px] text-ink-faint">
              {closed.total === 0
                ? 'nothing statemented'
                : late
                  ? `${Math.abs(due.daysToDue)} days late`
                  : `in ${due.daysToDue} days`}
            </span>
          </span>

          <span className="shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">
            <IconEdit size={15} />
          </span>
        </summary>

        <div className="space-y-5 border-t border-line bg-paper p-5">
          <div className="grid gap-px border border-line bg-line sm:grid-cols-3">
            <Cell
              label={`Statemented ${DATE.format(closed.from)}–${DATE.format(closed.to)}`}
              value={inr(closed.total)}
              sub={`${closed.count} ${closed.count === 1 ? 'entry' : 'entries'} · due ${DATE.format(closed.due)}`}
            />
            <Cell
              label="Since the statement"
              value={inr(open.total)}
              sub={`becomes the bill due ${DATE.format(open.due)}`}
            />
            <Cell
              label="Recurring on this card"
              value={inr(due.recurringMonthly)}
              sub="budget lines charged here each month"
            />
          </div>

          {open.total > 0 && (
            <p className="flex items-start gap-2 border border-line px-4 py-3 text-[13px] text-ink-soft">
              <IconClock size={15} className="mt-0.5 shrink-0 text-ink-faint" />
              <span>
                {inr(open.total)} spent since {DATE.format(closed.to)} is not on a
                statement yet. It falls due {DATE.format(open.due)}, so plan for it
                next month rather than this one.
              </span>
            </p>
          )}

          {due.unused && (
            <p className="flex items-start gap-2 border border-line px-4 py-3 text-[13px] text-ink-faint">
              <IconAlert size={15} className="mt-0.5 shrink-0" />
              <span>
                Nothing recorded against this card yet. Tag a spend to it when you
                log one, or point a budget line at it on the expenses page.
              </span>
            </p>
          )}

          <form action={saveCard} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <input type="hidden" name="id" value={card.id} />
            <Field label="Name">
              <Input name="name" defaultValue={card.name} />
            </Field>
            <Field label="Credit limit">
              <Input
                name="credit_limit"
                type="number"
                defaultValue={Number(card.credit_limit)}
              />
            </Field>
            <Field label="Statement day">
              <Input
                name="statement_day"
                type="number"
                min={1}
                max={31}
                defaultValue={card.statement_day}
              />
            </Field>
            <Field label="Due day">
              <Input
                name="due_day"
                type="number"
                min={1}
                max={31}
                defaultValue={card.due_day}
              />
            </Field>
            <div className="flex items-end gap-2 pb-1">
              <Button type="submit" size="sm">Save</Button>
              <ConfirmButton
                action={deleteCard}
                id={card.id}
                confirm={`Delete ${card.name}? Its statement history goes with it.`}
              />
            </div>
          </form>
        </div>
      </details>
    </li>
  );
}

function Cell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="eyebrow text-[10px]">{label}</div>
      <div className="tnum mt-1 text-[16px]">{value}</div>
      <div className="mt-1 text-[11px] leading-snug text-ink-faint">{sub}</div>
    </div>
  );
}
