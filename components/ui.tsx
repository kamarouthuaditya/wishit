import type { ReactNode } from 'react';
import { inr } from '@/lib/format';

/**
 * The primitives. Sharp edges throughout, depth from layered ground and
 * hairlines rather than shadow, and one lime accent doing real work.
 */

/*
 * `Button` is the one interactive primitive: its hover fill has to know where
 * the pointer crossed, so it is a client component and lives next door. It is
 * re-exported here so callers still import every primitive from one place.
 */
export { Button } from '@/components/button';

export type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'accent';

export function toneText(tone: Tone): string {
  switch (tone) {
    case 'good':
      return 'text-good';
    case 'warn':
      return 'text-warn';
    case 'bad':
      return 'text-bad';
    case 'accent':
      return 'text-accent';
    default:
      return 'text-ink';
  }
}

/**
 * A panel. Deliberately plain: a hairline, a label row, and room to breathe.
 *
 * `lead` puts a 2px `--accent` rule along the top edge — the one element on a
 * screen that matters most, and at most once per view.
 */
export function Card({
  title,
  hint,
  action,
  icon,
  lead,
  children,
  className = '',
}: {
  title?: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  /** Sits before the title, at 16px, in the label colour. */
  icon?: ReactNode;
  lead?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border border-line bg-surface ${
        lead ? 'border-t-2 border-t-accent' : ''
      } ${className}`}
    >
      {(title || action) && (
        <header className="flex items-baseline justify-between gap-4 border-b border-line px-5 py-3.5">
          <div>
            <h2 className="eyebrow flex items-center gap-2">
              {icon}
              {title}
            </h2>
            {hint && (
              <p className="mt-1.5 max-w-prose text-[13px] text-ink-faint">{hint}</p>
            )}
          </div>
          {action}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

/**
 * A run of rows, under a heading that is not one of them.
 *
 * The heading lives outside the box. Two attempts at putting it inside failed
 * the same way: a band holding a label on the left and a figure on the right is
 * the exact shape of the rows underneath it, so however the fill was tuned it
 * read as a slightly paler first row. `--surface-lift` against `--surface` is
 * 5.6 points in dark and about 2 in light — nowhere near enough to overcome a
 * repeated shape.
 *
 * Out here it is not competing. The heading sits on the page ground with air
 * around it, and the bordered box below contains data and nothing else, so the
 * border itself now marks where the group starts instead of merely wrapping it.
 *
 * Inside, two tokens do the work: rows on `--surface`, and a row under the
 * pointer or open dropping to `--ground` with its editor. `--surface-lift` is
 * no longer spent in here at all.
 *
 * `Card` remains for a panel of prose or figures; this is for a list.
 */
export function Section({
  title,
  hint,
  aside,
  footer,
  children,
  className = '',
}: {
  title: ReactNode;
  hint?: ReactNode;
  /** The section's own figure, right-aligned in the header band. */
  aside?: ReactNode;
  /** Sits under the rows, inside the border — an add form, usually. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pb-3">
        <div className="min-w-0">
          {/*
            Bigger than a row's name and in caps, so it cannot be mistaken for
            one even at a glance down the page.
          */}
          <h2 className="section-title text-[15px]">{title}</h2>
          {hint && (
            <p className="mt-1 max-w-prose text-[12.5px] leading-snug text-ink-faint">
              {hint}
            </p>
          )}
        </div>
        {aside && <div className="tnum shrink-0 text-[17px] font-semibold">{aside}</div>}
      </header>

      <div className="border border-line bg-surface">
        <div className="px-5">{children}</div>
        {footer && <div className="border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </section>
  );
}

/**
 * A figure with its label. `large` is the hero treatment: Playfair, 48px, the
 * brightest thing on the screen.
 */
export function Stat({
  label,
  value,
  sub,
  tone = 'neutral',
  large = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  large?: boolean;
}) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div
        className={`tnum mt-2 ${
          large
            ? 'font-display text-[34px] leading-none sm:text-[42px]'
            : 'text-[24px] font-medium leading-tight'
        } ${toneText(tone)}`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-2 max-w-prose text-[13px] leading-snug text-ink-soft">
          {sub}
        </div>
      )}
    </div>
  );
}

export function Pill({
  tone = 'neutral',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  const map: Record<Tone, string> = {
    neutral: 'border-line-strong text-ink-soft',
    good: 'border-good/50 text-good',
    warn: 'border-warn/50 text-warn',
    bad: 'border-bad/50 text-bad',
    accent: 'border-accent/50 text-accent',
  };
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${map[tone]}`}
    >
      {children}
    </span>
  );
}

export function Money({
  amount,
  tone,
  compact,
  sign,
  className = '',
}: {
  amount: number;
  tone?: Tone;
  compact?: boolean;
  sign?: boolean;
  className?: string;
}) {
  const resolved: Tone = tone ?? (amount < 0 ? 'bad' : 'neutral');
  return (
    <span className={`tnum ${toneText(resolved)} ${className}`}>
      {inr(amount, { compact, sign })}
    </span>
  );
}

export function Field({
  label,
  hint,
  muted,
  action,
  children,
}: {
  label: string;
  hint?: string;
  /** Dims the label when the control inside is disabled. */
  muted?: boolean;
  /** Sits opposite the label — a "Forgot?" link, say. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span
        className={`flex items-baseline justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.08em] ${
          muted ? 'text-ink-faint/60' : 'text-ink-faint'
        }`}
      >
        {label}
        {action}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-[12px] leading-snug text-ink-faint">
          {hint}
        </span>
      )}
    </label>
  );
}

/*
 * Controls sit on the page ground rather than the panel, so a field reads as a
 * cut into the surface instead of a raised chip. The lime border on focus is
 * the same signal as the focus ring elsewhere.
 */
const inputBase =
  'mt-1.5 w-full border border-line bg-paper px-3 py-2 text-[14px] text-ink outline-none ' +
  'transition-colors duration-[140ms] ' +
  'hover:border-line-strong focus:border-accent ' +
  'disabled:cursor-not-allowed disabled:border-dashed disabled:text-ink-faint ' +
  'aria-[invalid=true]:border-bad';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props;
  return <input {...rest} className={`${inputBase} ${className}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', children, ...rest } = props;
  return (
    <select {...rest} className={`${inputBase} ${className}`}>
      {children}
    </select>
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props;
  return <textarea {...rest} className={`${inputBase} ${className}`} />;
}


/** A square progress rule. 4px of ground, filled from the left. */
export function Bar({
  value,
  max,
  tone = 'accent',
}: {
  value: number;
  max: number;
  tone?: Tone;
}) {
  const filled = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const bg: Record<Tone, string> = {
    neutral: 'bg-ink-faint',
    good: 'bg-good',
    warn: 'bg-warn',
    bad: 'bg-bad',
    accent: 'bg-accent',
  };
  return (
    <div className="h-1 w-full bg-line" role="presentation">
      <div
        className={`h-full transition-[width] duration-[320ms] ${bg[tone]}`}
        style={{ width: `${filled * 100}%` }}
      />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="border border-dashed border-line px-4 py-8 text-center text-[14px] text-ink-faint">
      {children}
    </p>
  );
}

export function TrafficLight({ tone }: { tone: 'good' | 'warn' | 'bad' }) {
  const map = { good: 'bg-good', warn: 'bg-warn', bad: 'bg-bad' } as const;
  return <span className={`inline-block size-2 ${map[tone]}`} aria-hidden />;
}
