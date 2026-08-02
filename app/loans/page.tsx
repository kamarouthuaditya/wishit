import { addLoanQuick, deleteLoan, saveLoan } from '@/lib/actions';
import { loadReadySnapshot, loadSnapshot } from '@/lib/db/repository';
import { toLoanLine } from '@/lib/model/to-engine';
import {
  amortisationSchedule,
  emiFor,
  monthAnchor,
  noCostEmiTrueCost,
  prepaymentImpact,
  totalInterest,
  type AmortisationRow,
} from '@/lib/engine';
import { monthlyBalance } from '@/lib/model/balance';
import { inr, isoDate, monthLabel } from '@/lib/format';
import { Button, Empty, Field, Input, Money, Pill, Select } from '@/components/ui';
import { RowBar, StatBand, Vital } from '@/components/ledger';
import { IconArrowRight, IconEdit } from '@/components/icons';
import { ConfirmButton } from '@/components/confirm-button';
import { PageGuide } from '@/components/page-guide';
import { now as clockNow } from '@/lib/clock';
import type { LoanRow } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<LoanRow['type'], string> = {
  education: 'education',
  personal: 'personal',
  home: 'home',
  vehicle: 'vehicle',
  'consumer-emi': 'consumer emi',
  'no-cost-emi': 'no-cost emi',
  other: 'other',
};

/** A sane starting tenure per loan type, matching `addLoanQuick`'s default —
 *  shown in the composer hint, not hard-coded twice. */
const DEFAULT_TENURE: Record<LoanRow['type'], number> = {
  home: 240,
  education: 84,
  vehicle: 60,
  personal: 36,
  'consumer-emi': 12,
  'no-cost-emi': 6,
  other: 36,
};

/**
 * Loans: what each EMI is actually buying.
 *
 * An opened row used to be three nested `<details>` — prepayment, full
 * schedule, edit. Now it makes one argument: where a single EMI goes (a
 * stacked chart of interest against principal, sampled from the real
 * schedule) and what a prepayment would actually buy you, as a sentence with
 * the arithmetic in it rather than a badge.
 */
export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const snapshot = await loadReadySnapshot();
  const anchor = monthAnchor(clockNow());
  const today = clockNow();
  const balance = monthlyBalance(snapshot);

  const running = snapshot.loans.filter(
    (l) => new Date(l.start_date) <= today && l.tenure_months > 0,
  );
  const owed = running.reduce((sum, l) => sum + Number(l.outstanding), 0);
  const monthlyEmis = running.reduce((sum, l) => sum + Number(l.emi), 0);

  let interestLeft = 0;
  let debtFreeOffset = 0;
  let nextClear: { name: string; offset: number } | null = null;

  for (const l of running) {
    const line = toLoanLine(l, anchor);
    const rate = Number(l.annual_rate_pct);
    const emi = Number(l.emi) || emiFor(Number(l.outstanding), rate, l.tenure_months);
    const schedule = amortisationSchedule(
      Number(l.outstanding),
      rate,
      line.remainingMonths || l.tenure_months,
      emi,
    );
    interestLeft += totalInterest(schedule);
    // A running loan's own `startMonth` clamps to 1 — see `toLoanLine` — so
    // its payoff offset from today is just how many instalments remain.
    const payoff = schedule.length;
    if (payoff > debtFreeOffset) debtFreeOffset = payoff;
    if (!nextClear || payoff < nextClear.offset) nextClear = { name: l.name, offset: payoff };
  }

  const one = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="font-display text-[30px] leading-none">Loans</h1>
        <PageGuide guide="loans" />
      </div>

      <div className="mt-6">
        <StatBand
          eyebrow={`Owed across ${running.length} loan${running.length === 1 ? '' : 's'}`}
          figure={inr(owed)}
          note={
            <>
              EMIs come out before savings and goals, so clearing one lands
              straight in the balance left.
              {interestLeft > 0 && owed > 0 && (
                <>
                  {' '}
                  {inr(interestLeft)} of what you still owe is interest — that
                  is the part a prepayment can take back.
                </>
              )}
            </>
          }
        >
          <Vital
            label="EMIs a month"
            value={inr(monthlyEmis)}
            sub={
              balance.income > 0
                ? `${((monthlyEmis / balance.income) * 100).toFixed(1)}% of income`
                : undefined
            }
          />
          <Vital
            label="Interest left"
            value={inr(interestLeft)}
            sub={owed > 0 ? `${Math.round((interestLeft / owed) * 100)}% of what you still owe` : undefined}
          />
          <Vital
            label="Debt-free"
            value={running.length === 0 ? '—' : monthLabel(debtFreeOffset, anchor)}
            sub={nextClear ? `${nextClear.name} clears ${monthLabel(nextClear.offset, anchor)}` : undefined}
          />
        </StatBand>
      </div>

      {snapshot.loans.length === 0 ? (
        <div className="border-t border-line-strong py-8">
          <Empty>No loans yet — add one below.</Empty>
        </div>
      ) : (
        <ul className="border-t border-line-strong">
          {snapshot.loans.map((row) => (
            <LoanRowItem key={row.id} row={row} anchor={anchor} today={today} one={one} />
          ))}
        </ul>
      )}

      <form
        action={addLoanQuick}
        className="flex flex-wrap items-center gap-3 border-t border-line-strong bg-surface px-6 py-4 lg:px-9"
      >
        <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink">
          Add a loan
        </span>
        <input
          name="name"
          required
          placeholder="Name"
          className="min-w-[10rem] flex-1 border border-line bg-paper px-3 py-2.5 text-[14px] outline-none placeholder:text-ink-faint focus:border-accent"
        />
        <select
          name="type"
          defaultValue="personal"
          className="w-[170px] border border-line bg-paper px-3 py-2.5 text-[14px] outline-none focus:border-accent"
        >
          {(Object.keys(TYPE_LABEL) as LoanRow['type'][]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <input
          name="outstanding"
          type="number"
          step="1"
          required
          placeholder="Outstanding"
          className="tnum w-[150px] border border-line bg-paper px-3 py-2.5 text-[14px] outline-none placeholder:text-ink-faint focus:border-accent"
        />
        <input
          name="annual_rate_pct"
          type="number"
          step="0.1"
          placeholder="Rate %"
          className="tnum w-[110px] border border-line bg-paper px-3 py-2.5 text-[14px] outline-none placeholder:text-ink-faint focus:border-accent"
        />
        <Button type="submit" size="sm">
          Add loan
        </Button>
        <span className="text-[12px] text-ink-faint">
          EMI and tenure are worked out for you.
        </span>
      </form>
    </div>
  );
}

/** Even samples across the schedule, each an interest/principal split of
 *  that month's payment — capped at 16 so the chart reads as a shape, not a
 *  bar for every one of a 240-month home loan. */
function sampleColumns(
  schedule: AmortisationRow[],
  count: number,
): { interestPct: number; principalPct: number }[] {
  if (schedule.length === 0) return [];
  const n = Math.min(count, schedule.length);
  const columns: { interestPct: number; principalPct: number }[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i / Math.max(1, n - 1)) * (schedule.length - 1));
    const row = schedule[idx];
    const total = row.interest + row.principal;
    columns.push({
      interestPct: total > 0 ? (row.interest / total) * 100 : 0,
      principalPct: total > 0 ? (row.principal / total) * 100 : 0,
    });
  }
  return columns;
}

function LoanRowItem({
  row,
  anchor,
  today,
  one,
}: {
  row: LoanRow;
  anchor: Date;
  today: Date;
  one: (key: string) => string | undefined;
}) {
  const line = toLoanLine(row, anchor);
  const rate = Number(row.annual_rate_pct);
  const emi = Number(row.emi) || emiFor(Number(row.outstanding), rate, row.tenure_months);
  const schedule = amortisationSchedule(
    Number(row.outstanding),
    rate,
    line.remainingMonths || row.tenure_months,
    emi,
  );
  const interest = totalInterest(schedule);
  const started = new Date(row.start_date) <= today;
  const paid = Math.max(0, row.tenure_months - schedule.length);
  const endLabel =
    schedule.length > 0 ? monthLabel(line.startMonth! + schedule.length - 1, anchor) : null;
  const columns = sampleColumns(schedule, 16);

  const extra = Number(one('prepay') === row.id ? (one('extra') ?? 50000) : 50000);
  const invest = Number(one('prepay') === row.id ? (one('invest') ?? 8) : 8);

  return (
    <li>
      <details name="loans" className="group">
        <summary className="grid cursor-pointer list-none grid-cols-1 items-center gap-3 border-b border-line px-6 py-4 transition-colors duration-[140ms] hover:bg-ground group-open:bg-surface lg:grid-cols-[minmax(0,1fr)_320px_200px_40px] lg:gap-6 lg:px-9">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[16px]">{row.name}</span>
              <Pill tone="neutral">{TYPE_LABEL[row.type] ?? row.type}</Pill>
              {row.is_no_cost && <Pill tone="warn">&ldquo;no-cost&rdquo;</Pill>}
              {!started && <Pill tone="accent">starts later</Pill>}
            </div>
            <div className="tnum mt-1 text-[12px] text-ink-faint">
              {inr(Number(row.outstanding), { compact: true })} left at {rate}%
              {schedule.length > 0 && ` · ${schedule.length} EMIs to go, ends ${endLabel}`}
            </div>
          </div>

          <div>
            <RowBar value={paid} max={row.tenure_months || 1} tone={started ? 'accent' : 'neutral'} />
            <div className="tnum mt-[5px] text-[11px] text-ink-faint">
              {paid} of {row.tenure_months} paid
            </div>
          </div>

          <div className="text-right">
            <div className="tnum text-[19px]">
              {inr(emi)} <span className="text-[11px] text-ink-faint">/mo</span>
            </div>
            <div className="tnum mt-0.5 text-[11px] text-ink-faint">
              {inr(interest, { compact: true })} interest left
            </div>
          </div>

          <span className="hidden justify-self-end text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 lg:flex">
            <IconEdit size={15} />
          </span>
        </summary>

        <div className="border-b border-line bg-ground px-6 lg:px-9">
          <div className="grid gap-8 py-[26px] lg:grid-cols-[minmax(0,1.2fr)_1px_minmax(0,1fr)] lg:gap-0">
            <div>
              {row.is_no_cost && (
                <div className="mb-6">
                  <NoCostStrip row={row} />
                </div>
              )}
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink">
                Where each {inr(emi, { compact: true })} goes
              </h3>
              <p className="mt-1.5 text-[12px] text-ink-faint">
                Interest share falls as the principal clears.
                {columns.length > 0 &&
                  ` Today ${Math.round(columns[0].interestPct)} rupees in a hundred are interest.`}
              </p>

              {columns.length > 0 ? (
                <>
                  <div className="mt-4 flex h-24 items-end gap-1">
                    {columns.map((c, i) => (
                      <span key={i} className="flex h-full flex-1 flex-col justify-end">
                        <span className="w-full bg-accent-300" style={{ height: `${c.interestPct}%` }} />
                        <span className="w-full bg-accent-600" style={{ height: `${c.principalPct}%` }} />
                      </span>
                    ))}
                  </div>
                  <div className="tnum mt-1.5 flex justify-between text-[10px] text-ink-faint">
                    <span>{monthLabel(line.startMonth ?? 1, anchor)}</span>
                    <span>{endLabel ?? '—'}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="inline-block h-2 w-3.5 bg-accent-300" />
                      interest
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="inline-block h-2 w-3.5 bg-accent-600" />
                      principal
                    </span>
                  </div>
                  <details className="group mt-1">
                    <summary className="flex cursor-pointer list-none items-center justify-end gap-1 text-[11px] tracking-[0.08em] text-accent">
                      Full schedule, {schedule.length} rows
                      <IconArrowRight size={12} className="transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="mt-3 max-h-72 overflow-auto border border-line">
                      <table className="w-full min-w-[480px] text-[13px]">
                        <thead className="sticky top-0 bg-surface">
                          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-faint">
                            <th className="py-1.5 px-3 font-medium">#</th>
                            <th className="py-1.5 px-3 text-right font-medium">EMI</th>
                            <th className="py-1.5 px-3 text-right font-medium">Interest</th>
                            <th className="py-1.5 px-3 text-right font-medium">Principal</th>
                            <th className="py-1.5 px-3 text-right font-medium">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {schedule.map((r) => (
                            <tr key={r.month}>
                              <td className="py-1 px-3 text-ink-faint">{r.month}</td>
                              <td className="tnum py-1 px-3 text-right"><Money amount={r.emi} /></td>
                              <td className="tnum py-1 px-3 text-right text-ink-soft"><Money amount={r.interest} /></td>
                              <td className="tnum py-1 px-3 text-right"><Money amount={r.principal} /></td>
                              <td className="tnum py-1 px-3 text-right"><Money amount={r.closingBalance} compact /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </>
              ) : (
                <p className="mt-4 text-[13px] text-ink-faint">Nothing left to pay off.</p>
              )}
            </div>

            <div aria-hidden className="hidden bg-line lg:block" />

            <div className="lg:pl-9">
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink">
                If you prepaid {inr(extra, { compact: true })}
              </h3>
              <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="prepay" value={row.id} />
                <label className="min-w-[7rem] flex-1">
                  <span className="block text-[11px] uppercase tracking-[0.1em] text-ink-faint">
                    Lump sum
                  </span>
                  <input
                    name="extra"
                    type="number"
                    step="1"
                    defaultValue={extra}
                    className="tnum mt-[5px] w-full border border-line bg-paper px-2.5 py-[9px] text-[14px] outline-none focus:border-accent"
                  />
                </label>
                <label className="min-w-[7rem] flex-1">
                  <span className="block text-[11px] uppercase tracking-[0.1em] text-ink-faint">
                    If invested instead
                  </span>
                  <input
                    name="invest"
                    type="number"
                    step="0.1"
                    defaultValue={invest}
                    className="tnum mt-[5px] w-full border border-line bg-paper px-2.5 py-[9px] text-[14px] outline-none focus:border-accent"
                  />
                </label>
                <Button variant="ghost" size="sm" type="submit">
                  Calculate
                </Button>
              </form>

              <PrepayStrip outstanding={Number(row.outstanding)} rate={rate} emi={emi} extra={extra} invest={invest} />
            </div>
          </div>

          <div className="border-t border-line py-[26px]">
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
              Edit
            </h3>
            <div className="mt-4">
              <LoanForm row={row} defaultTenure={DEFAULT_TENURE[row.type] ?? 36} />
            </div>
          </div>
        </div>
      </details>
    </li>
  );
}

function PrepayStrip({
  outstanding,
  rate,
  emi,
  extra,
  invest,
}: {
  outstanding: number;
  rate: number;
  emi: number;
  extra: number;
  invest: number;
}) {
  const result = prepaymentImpact({
    outstanding,
    annualRatePct: rate,
    emi,
    extraPayment: extra,
    investmentReturnPct: invest,
  });

  return (
    <>
      <div className="mt-4 grid grid-cols-3 divide-x divide-line border border-line">
        <div className="px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.1em] text-ink-faint">Shorter by</div>
          <div className="tnum mt-[3px] text-[17px]">{result.monthsReduced} months</div>
        </div>
        <div className="px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.1em] text-ink-faint">Interest saved</div>
          <div className="tnum mt-[3px] text-[17px]">{inr(result.interestSaved, { compact: true })}</div>
        </div>
        <div className="px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.1em] text-ink-faint">EMIs after</div>
          <div className="tnum mt-[3px] text-[17px]">{result.monthsAfter}</div>
        </div>
      </div>

      <p
        className={`mt-3.5 text-justify text-[14px] ${result.counterfactual.investingWins ? 'text-warn' : 'text-good'}`}
      >
        {result.counterfactual.investingWins ? (
          <>
            Don&rsquo;t. This loan only charges {rate}%, so paying it off early
            saves you {inr(result.interestSaved)}. Put that same {inr(extra)}{' '}
            into something earning {invest}% and you&rsquo;d have{' '}
            {inr(result.counterfactual.futureValue)} by the time the loan
            would have ended — {inr(result.counterfactual.gain)} of gain. You
            come out ahead by roughly{' '}
            {inr(result.counterfactual.gain - result.interestSaved)} by
            investing it.
          </>
        ) : (
          <>
            Worth doing. The loan charges {rate}%, so prepaying saves{' '}
            {inr(result.interestSaved)}. The same {inr(extra)} at {invest}%
            would be {inr(result.counterfactual.futureValue)} by the date the
            loan ends — {inr(result.counterfactual.gain)} of gain against{' '}
            {inr(result.interestSaved)} saved. Prepaying wins here by{' '}
            {inr(result.interestSaved - result.counterfactual.gain)}.
          </>
        )}
      </p>
    </>
  );
}

function NoCostStrip({ row }: { row: LoanRow }) {
  const cost = noCostEmiTrueCost({
    stickerPrice: Number(row.principal),
    cashDiscount: Number(row.cash_discount),
    processingFee: Number(row.processing_fee),
    tenureMonths: row.tenure_months,
    notionalRatePct: Number(row.notional_rate_pct),
  });

  return (
    <div>
      <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-warn">
        &ldquo;No cost&rdquo; is not zero cost
      </h3>
      <div className="mt-3 grid grid-cols-2 divide-x divide-y divide-line border border-line sm:grid-cols-4 sm:divide-y-0">
        <div className="px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.1em] text-ink-faint">Sticker price</div>
          <div className="tnum mt-[3px] text-[16px]">{inr(cost.stickerPrice, { compact: true })}</div>
        </div>
        <div className="px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.1em] text-ink-faint">Discount forgone</div>
          <div className="tnum mt-[3px] text-[16px]">{inr(cost.discountForgone, { compact: true })}</div>
        </div>
        <div className="px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.1em] text-ink-faint">GST on interest</div>
          <div className="tnum mt-[3px] text-[16px]">{inr(cost.gstOnInterest, { compact: true })}</div>
        </div>
        <div className="px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.1em] text-warn">True cost</div>
          <div className="tnum mt-[3px] text-[16px] text-warn">{inr(cost.trueCost, { compact: true })}</div>
        </div>
      </div>
    </div>
  );
}

function LoanForm({
  row,
  defaultTenure,
}: {
  row: Awaited<ReturnType<typeof loadSnapshot>>['loans'][number];
  defaultTenure: number;
}) {
  return (
    <form action={saveLoan} className="grid items-end gap-3 sm:grid-cols-4">
      <input type="hidden" name="id" value={row.id} />
      <Field label="Name">
        <Input name="name" defaultValue={row.name} required />
      </Field>
      <Field label="Type">
        <Select name="type" defaultValue={row.type}>
          {/* A type outside the known set (stale data, an import) still gets
              its own option, so saving the rest of the form does not quietly
              overwrite it with whatever option happens to sort first. */}
          {!(row.type in TYPE_LABEL) && <option value={row.type}>{row.type}</option>}
          {(Object.keys(TYPE_LABEL) as LoanRow['type'][]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Principal">
        <Input name="principal" type="number" defaultValue={Number(row.principal)} required />
      </Field>
      <Field label="Outstanding">
        <Input name="outstanding" type="number" defaultValue={Number(row.outstanding)} />
      </Field>
      <Field label="Interest rate (%)" hint="Per year">
        <Input name="annual_rate_pct" type="number" step="0.1" defaultValue={Number(row.annual_rate_pct)} />
      </Field>
      <Field label="EMI">
        <Input name="emi" type="number" defaultValue={Number(row.emi)} />
      </Field>
      <Field label="Tenure (months)" hint={`Default for this type is ${defaultTenure}`}>
        <Input name="tenure_months" type="number" defaultValue={row.tenure_months} />
      </Field>
      <Field label="Start date">
        <Input name="start_date" type="date" defaultValue={row.start_date?.slice(0, 10) ?? isoDate()} />
      </Field>
      <Field label="Due day">
        <Input name="due_day" type="number" min={1} max={31} defaultValue={row.due_day ?? 5} />
      </Field>
      <Field label="Cash discount forgone" hint="Only for “no-cost” EMIs">
        <Input name="cash_discount" type="number" defaultValue={Number(row.cash_discount)} />
      </Field>
      <Field label="Processing fee">
        <Input name="processing_fee" type="number" defaultValue={Number(row.processing_fee)} />
      </Field>
      <label className="flex items-center gap-2 pb-2 text-[15px]">
        <input type="checkbox" name="is_no_cost" defaultChecked={row.is_no_cost} className="size-4 accent-[var(--accent)]" />
        No-cost EMI
      </label>
      <div className="flex gap-2 pb-1">
        <Button type="submit" size="sm">
          Save
        </Button>
        <ConfirmButton
          action={deleteLoan}
          id={row.id}
          confirm={`Delete ${row.name}? Its schedule and outstanding balance go with it.`}
        />
      </div>
    </form>
  );
}
