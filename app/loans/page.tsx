import { loadReadySnapshot, loadSnapshot } from '@/lib/db/repository';
import { deleteLoan, saveLoan } from '@/lib/actions';
import { toLoanLine } from '@/lib/model/to-engine';
import {
  amortisationSchedule,
  emiFor,
  monthAnchor,
  noCostEmiTrueCost,
  prepaymentImpact,
  totalInterest,
} from '@/lib/engine';
import { monthlyBalance } from '@/lib/model/balance';
import { inr, isoDate, monthLabel } from '@/lib/format';
import { Bar, Button, Card, Empty, Field, Input, Money, Pill, Select } from '@/components/ui';
import { IconEdit } from '@/components/icons';
import { ConfirmButton } from '@/components/confirm-button';
import { PageGuide } from '@/components/page-guide';
import { now as clockNow } from '@/lib/clock';


export const dynamic = 'force-dynamic';

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const snapshot = await loadReadySnapshot();
  const anchor = monthAnchor(clockNow());
  const balance = monthlyBalance(snapshot);
  const today = clockNow();
  const running = snapshot.loans.filter(
    (l) => new Date(l.start_date) <= today && l.tenure_months > 0,
  );
  const owed = running.reduce((sum, l) => sum + Number(l.outstanding), 0);
  const monthlyEmis = running.reduce((sum, l) => sum + Number(l.emi), 0);

  const one = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[30px] leading-none">Loans</h1>
            <PageGuide guide="loans" />
          </div>
          <p className="mt-3 max-w-prose text-[14px] text-ink-soft">
            Every EMI you are servicing, how much of each payment clears principal
            rather than interest, and what a prepayment would actually buy you.
            EMIs come out before savings and goals, so clearing one lands straight
            in the balance left.
          </p>
        </div>

        <dl className="flex items-end gap-px border border-line bg-line">
          <Figure label="Owed" value={owed} />
          <Figure label="EMIs a month" value={monthlyEmis} />
          <Figure label="Balance left" value={balance.balance} lead />
        </dl>
      </header>

      {snapshot.loans.length === 0 ? (
        <Empty>No loans yet. Add one below.</Empty>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
        {snapshot.loans.map((row) => {
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
          const paid = row.tenure_months - schedule.length;

          return (
            <li key={row.id} className="group">
            <details>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-3 py-4 transition-colors duration-[140ms] hover:bg-surface-lift">
                <span className="min-w-[12rem] flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px]">{row.name}</span>
                    <Pill tone="neutral">{row.type}</Pill>
                    {row.is_no_cost && <Pill tone="warn">“no-cost”</Pill>}
                    {!started && <Pill tone="accent">starts later</Pill>}
                  </span>

                  {/* How far through it you are, which is the one thing a list
                      of loans should show at a glance. */}
                  <span className="mt-2.5 block max-w-sm">
                    <Bar
                      value={Math.max(0, paid)}
                      max={row.tenure_months || 1}
                      tone={started ? 'accent' : 'neutral'}
                    />
                    <span className="mt-1.5 block text-[12px] text-ink-faint">
                      {inr(Number(row.outstanding), { compact: true })} left at {rate}%
                      {schedule.length > 0 &&
                        ` · ${schedule.length} EMIs to go, ends ${monthLabel(line.startMonth! + schedule.length - 1, anchor)}`}
                    </span>
                  </span>
                </span>

                <span className="text-right">
                  <span className="tnum block text-[19px]">
                    <Money amount={emi} />
                    <span className="ml-1 text-[11px] text-ink-faint">/mo</span>
                  </span>
                  <span className="mt-0.5 block text-[11px] text-ink-faint">
                    {inr(interest, { compact: true })} interest left
                  </span>
                </span>

                <span className="shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">
                  <IconEdit size={15} />
                </span>
              </summary>

              <div className="space-y-4 border-t border-line bg-paper px-4 py-5">
              {row.is_no_cost && <NoCostBreakdown row={row} />}

              <details className="mt-4">
                <summary className="cursor-pointer text-[13px] text-accent">
                  Prepayment
                </summary>
                <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="prepay" value={row.id} />
                  <Field label="Lump sum prepayment">
                    <Input
                      name="extra"
                      type="number"
                      defaultValue={one('prepay') === row.id ? one('extra') : 50000}
                    />
                  </Field>
                  <Field
                    label="Return if invested instead (%)"
                    hint="Per year"
                  >
                    <Input
                      name="invest"
                      type="number"
                      step="0.1"
                      defaultValue={one('prepay') === row.id ? (one('invest') ?? 8) : 8}
                    />
                  </Field>
                  <div className="pb-1">
                    <Button variant="ghost" type="submit">
                      Calculate
                    </Button>
                  </div>
                </form>
                {one('prepay') === row.id && (
                  <PrepaymentResult
                    outstanding={Number(row.outstanding)}
                    rate={rate}
                    emi={emi}
                    extra={Number(one('extra') ?? 0)}
                    invest={Number(one('invest') ?? 8)}
                  />
                )}
              </details>

              <details className="mt-3">
                <summary className="cursor-pointer text-[13px] text-accent">
                  Full schedule
                </summary>
                <div className="mt-3 max-h-80 overflow-auto">
                  <table className="w-full min-w-[520px] text-[13px]">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="border-b border-line text-left text-[12px] uppercase tracking-wide text-ink-faint">
                        <th className="py-2 pr-4 font-medium">#</th>
                        <th className="py-2 pr-4 text-right font-medium">EMI</th>
                        <th className="py-2 pr-4 text-right font-medium">
                          Interest
                        </th>
                        <th className="py-2 pr-4 text-right font-medium">
                          Principal
                        </th>
                        <th className="py-2 text-right font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {schedule.map((r) => (
                        <tr key={r.month}>
                          <td className="py-1.5 pr-4 text-ink-faint">{r.month}</td>
                          <td className="py-1.5 pr-4 text-right"><Money amount={r.emi} /></td>
                          <td className="py-1.5 pr-4 text-right text-ink-soft">
                            <Money amount={r.interest} />
                          </td>
                          <td className="py-1.5 pr-4 text-right"><Money amount={r.principal} /></td>
                          <td className="py-1.5 text-right">
                            <Money amount={r.closingBalance} compact />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>

              <details className="mt-3">
                <summary className="cursor-pointer text-[13px] text-accent">Edit</summary>
                <LoanForm row={row} />
              </details>
              </div>
            </details>
            </li>
          );
        })}
        </ul>
      )}

      <section>
        <h2 className="eyebrow border-b border-line-strong pb-2">Add a loan</h2>
        <div className="pt-4">
          <LoanForm />
        </div>
      </section>

      <NoCostCalculator params={params} />
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
        <Money amount={value} compact={value > 99999} />
      </dd>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <dt className="text-[12px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="tnum mt-0.5">{value}</dd>
      {sub && <dd className="text-[12px] text-ink-faint">{sub}</dd>}
    </div>
  );
}

function PrepaymentResult({
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
    <div className="mt-4 rounded-lg border border-line bg-paper p-4">
      <dl className="grid gap-4 text-[14px] sm:grid-cols-3">
        <Metric label="Tenure reduced by" value={`${result.monthsReduced} months`} />
        <Metric label="Interest saved" value={inr(result.interestSaved)} />
        <Metric label="EMIs remaining after" value={`${result.monthsAfter}`} />
      </dl>
      <p
        className={`mt-4 text-[14px] ${result.counterfactual.investingWins ? 'text-warn' : 'text-good'}`}
      >
        {result.counterfactual.investingWins ? (
          <>
            Don’t. This loan only charges {rate}%, so paying it off early saves you{' '}
            {inr(result.interestSaved)}. Put that same {inr(extra)} into something
            earning {invest}% and you’d have {inr(result.counterfactual.futureValue)} by
            the time the loan would have ended — {inr(result.counterfactual.gain)} of
            gain. You come out ahead by roughly{' '}
            {inr(result.counterfactual.gain - result.interestSaved)} by investing it.
          </>
        ) : (
          <>
            Worth doing. Paying early saves you {inr(result.interestSaved)} in interest,
            more than the {inr(result.counterfactual.gain)} the same money would have
            earned at {invest}%.
          </>
        )}
      </p>
    </div>
  );
}

function NoCostBreakdown({
  row,
}: {
  row: Awaited<ReturnType<typeof loadSnapshot>>['loans'][number];
}) {
  const cost = noCostEmiTrueCost({
    stickerPrice: Number(row.principal),
    cashDiscount: Number(row.cash_discount),
    processingFee: Number(row.processing_fee),
    tenureMonths: row.tenure_months,
    notionalRatePct: Number(row.notional_rate_pct),
  });

  return (
    <div className="mt-4 rounded-lg border border-warn/30 bg-warn-soft p-4">
      <p className="text-[13px] font-medium text-warn">
        “No cost” is not zero cost
      </p>
      <dl className="mt-3 grid gap-4 text-[14px] sm:grid-cols-4">
        <Metric label="Sticker price" value={inr(cost.stickerPrice)} />
        <Metric label="Cash discount forgone" value={inr(cost.discountForgone)} />
        <Metric label="GST on interest" value={inr(cost.gstOnInterest)} />
        <Metric label="True cost" value={inr(cost.trueCost)} />
      </dl>
    </div>
  );
}

function NoCostCalculator({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const get = (k: string, d: number) => {
    const v = params[k];
    const s = Array.isArray(v) ? v[0] : v;
    const n = Number(s);
    return Number.isFinite(n) && s ? n : d;
  };

  const price = get('nc_price', 29400);
  const tenure = get('nc_tenure', 6);
  const discount = get('nc_discount', 0);
  const fee = get('nc_fee', 199);
  const notional = get('nc_rate', 15);

  const cost = noCostEmiTrueCost({
    stickerPrice: price,
    cashDiscount: discount,
    processingFee: fee,
    tenureMonths: tenure,
    notionalRatePct: notional,
  });

  return (
    <Card
      title="No-cost EMI: true cost"
      hint="Sticker price versus what actually leaves your account"
    >
      <form method="get" className="grid items-end gap-3 sm:grid-cols-5">
        <Field label="Sticker price">
          <Input name="nc_price" type="number" defaultValue={price} />
        </Field>
        <Field label="Tenure (months)">
          <Input name="nc_tenure" type="number" defaultValue={tenure} />
        </Field>
        <Field label="Cash discount forgone" hint="What paying cash would have saved">
          <Input name="nc_discount" type="number" defaultValue={discount} />
        </Field>
        <Field label="Processing fee">
          <Input name="nc_fee" type="number" defaultValue={fee} />
        </Field>
        <div className="pb-1">
          <Button variant="ghost" type="submit">
            Calculate
          </Button>
        </div>
      </form>

      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-paper p-4">
          <div className="text-[12px] uppercase tracking-wide text-ink-faint">
            Sticker price
          </div>
          <div className="tnum mt-1 text-3xl font-semibold">{inr(cost.stickerPrice)}</div>
          <div className="mt-1 text-[13px] text-ink-soft">
            {inr(cost.monthlyEmi)} × {tenure} months
          </div>
        </div>
        <div className="rounded-lg border border-warn/40 bg-warn-soft p-4">
          <div className="text-[12px] uppercase tracking-wide text-warn">
            True cost
          </div>
          <div className="tnum mt-1 text-3xl font-semibold text-warn">
            {inr(cost.trueCost)}
          </div>
          <div className="mt-1 text-[13px] text-warn">
            {inr(cost.hiddenCost)} more than the sticker
          </div>
        </div>
      </div>

      <dl className="mt-4 grid gap-4 text-[14px] sm:grid-cols-3">
        <Metric
          label="Notional interest"
          value={inr(cost.notionalInterest)}
        />
        <Metric label="GST on interest" value={inr(cost.gstOnInterest)} />
        <Metric label="Processing fee" value={inr(cost.processingFee)} />
      </dl>
    </Card>
  );
}

function LoanForm({
  row,
}: {
  row?: Awaited<ReturnType<typeof loadSnapshot>>['loans'][number];
}) {
  return (
    <form action={saveLoan} className="mt-3 grid items-end gap-3 sm:grid-cols-4">
      {row && <input type="hidden" name="id" value={row.id} />}
      <Field label="Name">
        <Input name="name" defaultValue={row?.name} placeholder="Education loan" required />
      </Field>
      <Field label="Type">
        <Select name="type" defaultValue={row?.type ?? 'education'}>
          <option value="education">Education</option>
          <option value="personal">Personal</option>
          <option value="home">Home</option>
          <option value="vehicle">Vehicle</option>
          <option value="consumer-emi">Consumer EMI</option>
          <option value="no-cost-emi">“No-cost” EMI</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <Field label="Principal">
        <Input name="principal" type="number" defaultValue={row ? Number(row.principal) : ''} required />
      </Field>
      <Field label="Outstanding">
        <Input
          name="outstanding"
          type="number"
          defaultValue={row ? Number(row.outstanding) : ''}
        />
      </Field>
      <Field label="Interest rate (%)" hint="Per year">
        <Input
          name="annual_rate_pct"
          type="number"
          step="0.1"
          defaultValue={row ? Number(row.annual_rate_pct) : 0}
        />
      </Field>
      <Field label="EMI">
        <Input name="emi" type="number" defaultValue={row ? Number(row.emi) : ''} />
      </Field>
      <Field label="Tenure (months)">
        <Input name="tenure_months" type="number" defaultValue={row?.tenure_months ?? 12} />
      </Field>
      <Field label="Start date">
        <Input
          name="start_date"
          type="date"
          defaultValue={row?.start_date?.slice(0, 10) ?? isoDate()}
        />
      </Field>
      <Field label="Due day">
        <Input name="due_day" type="number" min={1} max={31} defaultValue={row?.due_day ?? 5} />
      </Field>
      <Field label="Cash discount forgone" hint="Only for “no-cost” EMIs">
        <Input
          name="cash_discount"
          type="number"
          defaultValue={row ? Number(row.cash_discount) : 0}
        />
      </Field>
      <Field label="Processing fee">
        <Input
          name="processing_fee"
          type="number"
          defaultValue={row ? Number(row.processing_fee) : 0}
        />
      </Field>
      <label className="flex items-center gap-2 pb-2 text-[14px]">
        <input
          type="checkbox"
          name="is_no_cost"
          defaultChecked={row?.is_no_cost}
          className="size-4"
        />
        No-cost EMI
      </label>
      <div className="flex gap-2 pb-1">
        <Button type="submit" size={row ? 'sm' : 'md'}>
          {row ? 'Save' : 'Add loan'}
        </Button>
        {row && (
          <ConfirmButton
            action={deleteLoan}
            id={row.id}
            confirm={`Delete ${row.name}? Its schedule and outstanding balance go with it.`}
          />
        )}
      </div>
    </form>
  );
}
