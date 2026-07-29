/**
 * One clock for the whole app, and it is not the host's.
 *
 * Every "today" in Wishit is a wall-clock question — which day a spend belongs
 * to, which month the review is closing, how many days of the month have
 * elapsed. The host answers with its own timezone, and the host is a Vercel
 * function in UTC. For a user in India that means the first five and a half
 * hours of every day are dated to yesterday, and the first five and a half
 * hours of the 1st land in the previous month's review.
 *
 * So the app carries its own timezone. `now()` returns a Date whose *local*
 * getters — getFullYear, getMonth, getDate — read the app timezone's wall
 * clock, whatever the machine is set to. That keeps the forty-odd existing call
 * sites working unchanged: they already ask for wall-clock parts, they just
 * used to ask the wrong clock.
 *
 * The consequence, and the reason this file is small and loud: a Date from
 * `now()` is a wall-clock reading, not an instant. Its `getTime()` and
 * `toISOString()` are shifted and mean nothing. Never persist one, never
 * compare one against `created_at`. For a stored timestamp use `new Date()`.
 */

/**
 * Overridable so a deployment for another country does not need a code change.
 * `NEXT_PUBLIC_` because the same date formatting runs in the browser, and a
 * server and client that disagree about today is a hydration mismatch on every
 * date field.
 */
export const APP_TZ = process.env.NEXT_PUBLIC_APP_TIMEZONE || 'Asia/Kolkata';

/** en-CA gives ISO order — YYYY-MM-DD — which is the only reason it is here. */
const DATE_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const CLOCK_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** The calendar date of an instant, in the app timezone. */
export function dateInAppTz(instant: Date = new Date()): string {
  return DATE_PARTS.format(instant);
}

/**
 * "Now", as a Date whose local getters read the app timezone.
 *
 * Built from formatted parts rather than an offset arithmetic trick so that
 * daylight saving — which Asia/Kolkata does not observe, but a future
 * NEXT_PUBLIC_APP_TIMEZONE might — is the formatter's problem, not ours.
 */
export function now(instant: Date = new Date()): Date {
  const parts = CLOCK_PARTS.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  // hour is 00-23 under hour12:false, except some ICU versions render midnight
  // as 24. Normalising here keeps the constructed date on the right day.
  const hour = get('hour') % 24;

  return new Date(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second'),
  );
}

/** Midnight today, in the app timezone. */
export function today(): Date {
  const d = now();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
