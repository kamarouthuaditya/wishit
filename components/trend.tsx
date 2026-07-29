import Link from 'next/link';
import { inr, pct } from '@/lib/format';
import { Card, Empty, Money } from '@/components/ui';
import type { MonthlySnapshotRow } from '@/lib/db/types';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function label(month: string): string {
  const d = new Date(month);
  return `${MONTHS[d.getMonth()]} ’${String(d.getFullYear()).slice(2)}`;
}

/**
 * Net worth over the months that were actually recorded.
 *
 * Drawn as an area rather than bars because net worth is routinely negative
 * while you are paying off a loan, and a bar chart of negative numbers is
 * nonsense: the previous version scaled every bar from zero, so a series
 * running from −10.6L to −9.9L rendered as twelve invisible slivers. An area
 * between the series and its own floor shows the shape of the thing, which is
 * the only part anyone reads.
 *
 * Reads recorded history only. Nothing here is recomputed from today's inputs,
 * so editing an expense cannot rewrite what the past looked like.
 */
export function NetWorthTrend({ snapshots }: { snapshots: MonthlySnapshotRow[] }) {
  const rows = [...snapshots]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);

  if (rows.length < 2) {
    return (
      <Card title="Net worth" hint="Savings less liabilities, recorded monthly">
        <Empty>
          {rows.length === 0
            ? 'No months recorded yet.'
            : 'One month recorded — a trend needs a second.'}{' '}
          <Link href="/review" className="text-accent">
            Record this month
          </Link>{' '}
          from the review page.
        </Empty>
      </Card>
    );
  }

  const values = rows.map((r) => Number(r.net_worth));
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // Padding keeps the line off the frame; a flat series still gets a mid-height
  // line rather than dividing by zero.
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.18;
  const floor = lo - pad;
  const ceiling = hi + pad;

  const W = 100;
  const H = 34;
  const x = (i: number) => (i / (rows.length - 1)) * W;
  const y = (v: number) => H - ((v - floor) / (ceiling - floor)) * H;

  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;

  const first = values[0];
  const last = values.at(-1)!;
  const change = last - first;
  const crossesZero = lo < 0 && hi > 0;

  return (
    <Card
      title="Net worth"
      hint={`${rows.length} months recorded — savings less liabilities`}
      action={
        <span className="text-[15px] font-semibold">
          <Money amount={change} tone={change >= 0 ? 'good' : 'bad'} sign compact />
        </span>
      }
    >
      <figure className="m-0">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-36 w-full"
          role="img"
          aria-label={`Net worth from ${inr(first)} in ${label(rows[0].month)} to ${inr(last)} in ${label(rows.at(-1)!.month)}`}
        >
          {crossesZero && (
            <line
              x1="0"
              x2={W}
              y1={y(0)}
              y2={y(0)}
              stroke="var(--line-strong)"
              strokeWidth="0.3"
              strokeDasharray="1.5 1.5"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {/*
            The fill carries its own alpha per theme — forest on black, lime on
            paper — because a 45% forest wash that reads on black disappears
            entirely under daylight. The line itself is `--accent`, which is the
            one accent role guaranteed to survive at 1.5px on either ground.
          */}
          <path d={area} fill="var(--chart-fill)" />
          <path
            d={line}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
          {values.map((v, i) => (
            <rect
              key={rows[i].month}
              x={x(i) - 0.6}
              y={y(v) - 0.6 * (H / W)}
              width="1.2"
              height={1.2 * (H / W)}
              fill="var(--accent)"
            />
          ))}
        </svg>

        <figcaption className="mt-2 flex justify-between text-[11px] text-ink-faint">
          <span>
            {label(rows[0].month)} · {inr(first, { compact: true })}
          </span>
          <span className="text-ink-soft">
            {label(rows.at(-1)!.month)} · {inr(last, { compact: true })}
          </span>
        </figcaption>
      </figure>

      <dl className="mt-6 grid gap-px border border-line bg-line sm:grid-cols-3">
        <Figure label="Latest balance" value={inr(Number(rows.at(-1)!.corpus), { compact: true })} />
        <Figure label="Surplus that month" value={inr(Number(rows.at(-1)!.surplus))} />
        <Figure label="Savings rate" value={pct(Number(rows.at(-1)!.savings_rate), 1)} />
      </dl>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="eyebrow text-[10px]">{label}</dt>
      <dd className="tnum mt-1 text-[16px]">{value}</dd>
    </div>
  );
}
