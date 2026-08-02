import type { ReactNode } from 'react';

/**
 * Shared shape for the two ledger pages, `/loans` and `/cards`: a stat band
 * (one hero figure and its justified note on the left, three stacked vitals
 * on the right) sitting above a hairline-separated row list. Split out
 * because both pages want the exact same frame, not because either page
 * needs it to be generic.
 */
export function StatBand({
  eyebrow,
  figure,
  note,
  children,
}: {
  eyebrow: string;
  figure: string;
  note: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid border-t border-line-strong lg:grid-cols-[minmax(0,1.5fr)_1px_minmax(0,1fr)]">
      <div className="p-6 lg:p-9">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          {eyebrow}
        </div>
        <div className="tnum font-display mt-2 text-[52px] leading-none sm:text-[72px]">
          {figure}
        </div>
        <p className="mt-3.5 max-w-[58ch] text-justify text-[13px] leading-relaxed text-ink-faint">
          {note}
        </p>
      </div>

      <div aria-hidden className="hidden bg-line lg:block" />

      <div className="grid grid-cols-1 divide-y divide-line border-t border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:flex lg:flex-col lg:divide-x-0 lg:divide-y lg:border-t-0">
        {children}
      </div>
    </div>
  );
}

export function Vital({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="px-6 py-5 lg:px-9">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </div>
      <div className="tnum font-display mt-[3px] text-[26px] leading-none">{value}</div>
      {sub && <div className="mt-1 text-[12px] text-ink-faint">{sub}</div>}
    </div>
  );
}

/** A 6px progress rule on a `--surface-lift` track — the reference's own
 *  neutral-200, distinct from the shared `Bar` primitive's hairline track,
 *  which reads too faint at this width against a bordered row. */
export function RowBar({
  value,
  max,
  tone = 'accent',
}: {
  value: number;
  max: number;
  tone?: 'accent' | 'warn' | 'neutral';
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill =
    tone === 'warn' ? 'bg-warn' : tone === 'neutral' ? 'bg-ink-faint/50' : 'bg-accent-600';
  return (
    <div className="h-[6px] w-full bg-surface-lift">
      <div className={`h-full ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
