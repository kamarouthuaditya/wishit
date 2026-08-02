'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Notice } from '@/lib/model/notifications';
import { IconAlert, IconCheck, IconClose } from '@/components/icons';

/**
 * The bell.
 *
 * Notices are facts about the data, recomputed every request, so "unread" is
 * the only part that needs remembering. That lives in this browser rather than
 * the database: dismissing "card bill due in 4 days" is a statement about
 * having seen it, not about your money, and it is not worth a write.
 *
 * A dismissal is keyed to the notice, so paying the bill and letting the next
 * one arrive brings the bell back by itself.
 */
const STORE = 'wishit_seen_notices';

export function Notifications({ notices }: { notices: Notice[] }) {
  const [open, setOpen] = useState(false);
  // Read lazily rather than in an effect: localStorage is available the moment
  // this component runs on the client, and setting state from an effect just to
  // read it costs an extra render with the wrong badge on screen.
  const [seen, setSeen] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(window.localStorage.getItem(STORE) ?? '[]');
    } catch {
      return [];
    }
  });
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const unread = useMemo(
    () => notices.filter((notice) => !seen.includes(notice.id)),
    [notices, seen],
  );

  const dismissAll = () => {
    const next = [...new Set([...seen, ...notices.map((n) => n.id)])].slice(-80);
    setSeen(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      // A browser that refuses storage just gets the count back next load.
    }
  };

  const urgent = unread.some((notice) => notice.tone === 'bad');

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          unread.length > 0
            ? `Notifications, ${unread.length} unread`
            : 'Notifications'
        }
        className="relative inline-flex cursor-pointer items-center p-1.5 text-ink-soft transition-colors duration-[140ms] hover:bg-surface-lift hover:text-accent"
      >
        <Bell />
        {unread.length > 0 && (
          <span
            className={`absolute right-0 top-0 flex min-w-[15px] items-center justify-center px-1 text-[9px] font-bold leading-[15px] text-paper ${
              urgent ? 'bg-bad' : 'bg-accent'
            }`}
          >
            {unread.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="rise absolute right-0 top-[calc(100%+0.6rem)] z-50 w-[min(24rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl bg-surface shadow-lg ring-1 ring-line-strong/60"
        >
          <div className="flex items-center justify-between border-b border-line/70 px-4 py-3">
            <span className="eyebrow">
              {notices.length === 0 ? 'Nothing needs you' : 'Needs a look'}
            </span>
            <span className="flex items-center gap-3">
              {unread.length > 0 && (
                <button
                  type="button"
                  onClick={dismissAll}
                  className="inline-flex cursor-pointer items-center gap-1 text-[12px] text-ink-faint transition-colors hover:text-accent"
                >
                  <IconCheck size={12} />
                  Mark seen
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer text-ink-faint transition-colors hover:text-ink"
                aria-label="Close"
              >
                <IconClose size={15} />
              </button>
            </span>
          </div>

          {notices.length === 0 ? (
            <p className="px-4 py-6 text-center text-[14px] text-ink-faint">
              No bills due, nothing overspent, no goal off track.
            </p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {notices.map((notice) => (
                <li key={notice.id} className="border-b border-line/70 last:border-0">
                  <Link
                    href={notice.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 transition-colors duration-[140ms] hover:bg-surface-lift"
                  >
                    <span
                      aria-hidden
                      className={`mt-1 size-2 shrink-0 ${
                        notice.tone === 'bad'
                          ? 'bg-bad'
                          : notice.tone === 'warn'
                            ? 'bg-warn'
                            : 'bg-ink-faint'
                      } ${seen.includes(notice.id) ? 'opacity-30' : ''}`}
                    />
                    <span>
                      <span className="block text-[14px] text-ink">{notice.title}</span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-ink-faint">
                        {notice.detail}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Square-shouldered bell, drawn to match the icon set rather than imported. */
function Bell() {
  return (
    <svg
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      aria-hidden
      focusable="false"
    >
      <path d="M6 9a6 6 0 0 1 12 0v6l2 3H4l2-3z" />
      <path d="M10 21h4" />
    </svg>
  );
}

export { IconAlert };
