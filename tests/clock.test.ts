import { describe, expect, it } from 'vitest';
import { dateInAppTz, now } from '@/lib/clock';
import { isoDate } from '@/lib/format';
import { monthKey } from '@/lib/model/spending';

/**
 * The bug these pin down: the app is deployed on a UTC host and used from
 * India. 00:30 IST on 1 August is 19:00 UTC on 31 July, so the host would date
 * a spend to the wrong day *and* file it under the wrong month's review.
 */
const HALF_PAST_MIDNIGHT_IST = new Date('2026-07-31T19:00:00.000Z');
const LATE_EVENING_IST = new Date('2026-07-31T17:00:00.000Z'); // 22:30 IST, 31 Jul

describe('app timezone', () => {
  it('dates the small hours to the day India is having, not the host', () => {
    expect(HALF_PAST_MIDNIGHT_IST.toISOString().slice(0, 10)).toBe('2026-07-31');
    expect(dateInAppTz(HALF_PAST_MIDNIGHT_IST)).toBe('2026-08-01');
    expect(isoDate(HALF_PAST_MIDNIGHT_IST)).toBe('2026-08-01');
  });

  it('leaves an instant that is the same day in both zones alone', () => {
    expect(dateInAppTz(LATE_EVENING_IST)).toBe('2026-07-31');
  });

  it('gives a Date whose local getters read the Indian wall clock', () => {
    const d = now(HALF_PAST_MIDNIGHT_IST);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // August
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(30);
  });

  it('files the small hours of the 1st under the new month', () => {
    expect(monthKey(now(HALF_PAST_MIDNIGHT_IST))).toBe('2026-08');
    expect(monthKey(now(LATE_EVENING_IST))).toBe('2026-07');
  });
});
