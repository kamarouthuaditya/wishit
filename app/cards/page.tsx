import { loadReadySnapshot } from '@/lib/db/repository';
import { driver } from '@/lib/db/driver';
import { deleteCard, saveCard } from '@/lib/actions';
import { cardDues, type CardDue } from '@/lib/model/cards';
import { inr } from '@/lib/format';
import { Button, Empty, Field, Input, Money, Pill } from '@/components/ui';
import { RowBar, StatBand, Vital } from '@/components/ledger';
import { IconAlert, IconCard, IconClock, IconEdit } from '@/components/icons';
import { ConfirmButton } from '@/components/confirm-button';
import { PageGuide } from '@/components/page-guide';
import type { TransactionRow } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

const DATE = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });

/**
 * Cards, as dues.
 *
 * A card bill is money already spent that leaves on a date you did not
 * choose, which makes it the same kind of thing as an EMI. An opened row
 * used to be three cells and a form; now it also shows the billing cycle as
 * a timeline, so the money that is not on a statement yet is visible rather
 * than implied.
 */
export default async function CardsPage() {
  const snapshot = await loadReadySnapshot();
  const transactions = await driver().list<TransactionRow>('transaction');
  const dues = cardDues(snapshot.cards, transactions, snapshot.expenses);

  const payable = dues.reduce((sum, due) => sum + due.closed.total, 0);
  const accruing = dues.reduce((sum, due) => sum + due.open.total, 0);
  const totalLimit = dues.reduce((sum, due) => sum + (Number(due.card.credit_limit) || 0), 0);
  const utilisation = totalLimit > 0 ? (payable / totalLimit) * 100 : 0;
  const nextDue = dues.filter((d) => d.closed.total > 0).sort((a, b) => a.daysToDue - b.daysToDue)[0];

  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="font-display text-[30px] leading-none">Cards</h1>
        <PageGuide guide="cards" />
      </div>

      <div className="mt-6">
        <StatBand
          eyebrow="Statemented and due"
          figure={inr(payable)}
          note={
            <>
              A card bill is money already spent, so nothing here is charged
              to the budget twice — what a card changes is the timing. Tag a
              spend to a card when you log it and it lands here instead of
              leaving your account that day.
            </>
          }
        >
          <Vital label="Still accruing" value={inr(accruing)} sub="Becomes next month's bill" />
          <Vital
            label="Next due"
            value={nextDue ? DATE.format(nextDue.closed.due) : '—'}
            sub={
              nextDue
                ? `${nextDue.card.name}, ${
                    nextDue.daysToDue < 0
                      ? `${Math.abs(nextDue.daysToDue)} days late`
                      : `in ${nextDue.daysToDue} days`
                  }`
                : 'Nothing due'
            }
          />
          <Vital
            label="Utilisation"
            value={`${Math.round(utilisation)}%`}
            sub={totalLimit > 0 ? `Across ${inr(totalLimit, { compact: true })} of limit` : 'No limit set'}
          />
        </StatBand>
      </div>

      {dues.length === 0 ? (
        <div className="border-t border-line-strong py-8">
          <Empty>
            No cards yet. Add one below to see what a statement is quietly
            building up to.
          </Empty>
        </div>
      ) : (
        <ul className="border-t border-line-strong">
          {dues.map((due) => (
            <CardRowItem key={due.card.id} due={due} />
          ))}
        </ul>
      )}

      <form
        action={saveCard}
        className="flex flex-wrap items-center gap-3 border-t border-line-strong bg-surface px-6 py-4 lg:px-9"
      >
        <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink">
          Add a card
        </span>
        <input
          name="name"
          required
          placeholder="Name — &ldquo;HDFC Millennia&rdquo;"
          className="min-w-[12rem] flex-1 border border-line bg-paper px-3 py-2.5 text-[14px] outline-none placeholder:text-ink-faint focus:border-accent"
        />
        <input
          name="credit_limit"
          type="number"
          step="1"
          placeholder="Credit limit"
          className="tnum w-[150px] border border-line bg-paper px-3 py-2.5 text-[14px] outline-none placeholder:text-ink-faint focus:border-accent"
        />
        <input
          name="statement_day"
          type="number"
          min={1}
          max={31}
          defaultValue={1}
          aria-label="Bill cut on"
          className="tnum w-[150px] border border-line bg-paper px-3 py-2.5 text-[14px] outline-none focus:border-accent"
        />
        <input
          name="due_day"
          type="number"
          min={1}
          max={31}
          defaultValue={20}
          aria-label="Due on"
          className="tnum w-[150px] border border-line bg-paper px-3 py-2.5 text-[14px] outline-none focus:border-accent"
        />
        <Button type="submit" size="sm">
          Add card
        </Button>
      </form>
    </div>
  );
}

function clamp(pct: number): number {
  return Math.min(100, Math.max(0, pct));
}

function cyclePositions(due: CardDue): { cutPct: number; duePct: number } {
  const start = due.closed.from.getTime();
  const end = due.open.to.getTime();
  const span = end - start || 1;
  return {
    cutPct: clamp(((due.closed.to.getTime() - start) / span) * 100),
    duePct: clamp(((due.closed.due.getTime() - start) / span) * 100),
  };
}

function CardRowItem({ due }: { due: CardDue }) {
  const { card, closed, open } = due;
  const limit = Number(card.credit_limit) || 0;
  const late = due.daysToDue < 0 && closed.total > 0;
  const soon = due.daysToDue >= 0 && due.daysToDue <= 5 && closed.total > 0;
  const dueTone = late ? 'text-bad' : soon ? 'text-warn' : 'text-accent';
  const { cutPct, duePct } = cyclePositions(due);

  return (
    <li>
      <details name="cards" className="group">
        <summary className="grid cursor-pointer list-none grid-cols-1 items-center gap-3 border-b border-line px-6 py-4 transition-colors duration-[140ms] hover:bg-ground group-open:bg-surface lg:grid-cols-[minmax(0,1fr)_300px_200px_40px] lg:gap-6 lg:px-9">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <IconCard size={15} className="text-ink-faint" />
              <span className="text-[16px]">{card.name}</span>
              {late && <Pill tone="bad">overdue</Pill>}
              {soon && <Pill tone="warn">due soon</Pill>}
            </div>
            <div className="tnum mt-1 text-[12px] text-ink-faint">
              {due.unused
                ? 'Nothing recorded against this card yet'
                : `Statemented ${DATE.format(closed.from)}–${DATE.format(closed.to)} · ${closed.count} ${closed.count === 1 ? 'entry' : 'entries'}`}
            </div>
          </div>

          <div>
            <RowBar value={closed.total} max={limit || 1} tone={due.utilisation > 0.5 ? 'warn' : 'accent'} />
            <div className="tnum mt-[5px] text-[11px] text-ink-faint">
              {limit > 0
                ? `${inr(closed.total, { compact: true })} of ${inr(limit, { compact: true })} limit${
                    due.utilisation > 0.03 ? ` · ${Math.round(due.utilisation * 100)}% used` : ''
                  }`
                : `${inr(closed.total, { compact: true })} spent`}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.1em] text-ink-faint">
              Due {DATE.format(closed.due)}
            </div>
            <div className={`tnum mt-[2px] text-[19px] ${closed.total === 0 ? 'text-ink-faint' : ''}`}>
              <Money amount={closed.total} tone={late ? 'bad' : soon ? 'warn' : 'neutral'} />
            </div>
            <div className="tnum text-[11px] text-ink-faint">
              {closed.total === 0
                ? 'nothing statemented'
                : late
                  ? `${Math.abs(due.daysToDue)} days late`
                  : `in ${due.daysToDue} days`}
            </div>
          </div>

          <span className="hidden justify-self-end text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 lg:flex">
            <IconEdit size={15} />
          </span>
        </summary>

        <div className="border-b border-line bg-ground px-6 py-[26px] lg:px-9">
          {!due.unused && (
            <>
              <div className="grid grid-cols-1 divide-y divide-line border border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
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

              <div className="mt-6">
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink">
                  The cycle
                </h3>
                <div className="relative mt-5 h-[52px]">
                  <div className="absolute inset-x-0 top-4 flex h-2">
                    <span className="bg-accent-600" style={{ width: `${cutPct}%` }} />
                    <span className="bg-accent-300" style={{ width: `${duePct - cutPct}%` }} />
                    <span className="flex-1 bg-surface-lift" />
                  </div>
                  <div
                    className="absolute top-1.5 h-7 w-px bg-ink"
                    style={{ left: `${cutPct}%` }}
                  />
                  <div
                    className={`absolute top-1.5 h-7 w-px ${late ? 'bg-bad' : soon ? 'bg-warn' : 'bg-ink'}`}
                    style={{ left: `${duePct}%` }}
                  />
                  <div className="tnum absolute top-[34px] left-0 text-[11px] text-ink-faint">
                    {DATE.format(closed.from)} — cycle opens
                  </div>
                  <div
                    className="tnum absolute top-[34px] ml-2 text-[11px]"
                    style={{ left: `${cutPct}%` }}
                  >
                    {DATE.format(closed.to)} — bill cut, {inr(closed.total, { compact: true })}
                  </div>
                  <div
                    className={`tnum absolute top-[34px] ml-2 text-[11px] ${dueTone}`}
                    style={{ left: `${duePct}%` }}
                  >
                    {DATE.format(closed.due)} — due
                  </div>
                </div>
              </div>

              {open.total > 0 && (
                <p className="mt-16 flex items-start gap-2.5 border border-line px-4 py-3 text-[13px] text-ink-soft sm:mt-6">
                  <IconClock size={15} className="mt-0.5 shrink-0 text-ink-faint" />
                  <span>
                    {inr(open.total)} spent since {DATE.format(closed.to)} is
                    not on a statement yet. It falls due{' '}
                    {DATE.format(open.due)}, so plan for it next month rather
                    than this one.
                  </span>
                </p>
              )}
            </>
          )}

          {due.unused && (
            <p className="flex items-start gap-2.5 text-[14px] text-ink-faint">
              <IconAlert size={15} className="mt-0.5 shrink-0" />
              <span>
                Nothing recorded against this card yet. Tag a spend to it when
                you log one, or point a budget line at it on the expenses
                page.
              </span>
            </p>
          )}

          <div className={due.unused ? 'mt-5' : 'mt-8'}>
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
              Edit
            </h3>
            <form action={saveCard} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <input type="hidden" name="id" value={card.id} />
              <Field label="Name">
                <Input name="name" defaultValue={card.name} />
              </Field>
              <Field label="Credit limit">
                <Input name="credit_limit" type="number" defaultValue={Number(card.credit_limit)} />
              </Field>
              <Field label="Statement day">
                <Input name="statement_day" type="number" min={1} max={31} defaultValue={card.statement_day} />
              </Field>
              <Field label="Due day">
                <Input name="due_day" type="number" min={1} max={31} defaultValue={card.due_day} />
              </Field>
              <div className="flex items-end gap-2 pb-1">
                <Button type="submit" size="sm">
                  Save
                </Button>
                <ConfirmButton
                  action={deleteCard}
                  id={card.id}
                  confirm={`Delete ${card.name}? Its statement history goes with it.`}
                />
              </div>
            </form>
          </div>
        </div>
      </details>
    </li>
  );
}

function Cell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[10px] uppercase tracking-[0.1em] text-ink-faint">{label}</div>
      <div className="tnum font-display mt-1 text-[24px]">{value}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-ink-faint">{sub}</div>
    </div>
  );
}
