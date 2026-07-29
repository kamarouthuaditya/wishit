import { dateInAppTz } from '@/lib/clock';

export function inr(amount: number, opts?: { compact?: boolean; sign?: boolean }): string {
  const rounded = Math.round(amount);
  const abs = Math.abs(rounded);
  const body = opts?.compact && abs >= 1_00_000
    ? abs >= 1_00_00_000
      ? `${(abs / 1_00_00_000).toFixed(abs % 1_00_00_000 === 0 ? 0 : 2)}Cr`
      : `${(abs / 1_00_000).toFixed(abs % 1_00_000 === 0 ? 0 : 2)}L`
    : abs.toLocaleString('en-IN');
  const sign = rounded < 0 ? '−' : opts?.sign ? '+' : '';
  return `${sign}₹${body}`;
}

export function pct(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function months(value: number | null, digits = 1): string {
  if (value == null) return '—';
  return `${value.toFixed(digits)} mo`;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Month offset -> "Oct 2026", relative to the simulation anchor. */
export function monthLabel(offset: number, anchor: Date): string {
  const d = new Date(anchor.getFullYear(), anchor.getMonth() + Math.round(offset), 1);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Today, or the calendar date of an instant — read in the app timezone, not
 * the host's. `toISOString().slice(0, 10)` used to answer this and answered it
 * in UTC, which dates an 00:30 IST spend to yesterday. See `lib/clock.ts`.
 */
export function isoDate(date = new Date()): string {
  return dateInAppTz(date);
}

export function num(value: FormDataEntryValue | null, fallback = 0): number {
  if (value == null) return fallback;
  const parsed = Number(String(value).replace(/[,₹\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function str(value: FormDataEntryValue | null, fallback = ''): string {
  const s = value == null ? '' : String(value).trim();
  return s === '' ? fallback : s;
}

export function optionalStr(value: FormDataEntryValue | null): string | null {
  const s = value == null ? '' : String(value).trim();
  return s === '' ? null : s;
}

export function optionalNum(value: FormDataEntryValue | null): number | null {
  const s = value == null ? '' : String(value).trim();
  if (s === '') return null;
  const parsed = Number(s.replace(/[,₹\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}
