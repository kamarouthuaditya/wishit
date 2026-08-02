'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import { GUIDES, type Guide, type GuideKey } from '@/lib/guides';
import { IconArrowRight, IconClose, IconInfo } from '@/components/icons';

/**
 * The "what is this page even for" button.
 *
 * Expenses and Spending are the same word to anyone who has not been told
 * otherwise, and a title with a sentence under it is not enough room to explain
 * that one is a plan and the other a record. So each page carries a marker next
 * to its heading that opens the long answer: what the page is, the pages it
 * gets mistaken for and why they differ, and one worked example with rupee
 * figures you can follow line by line.
 *
 * Until you have opened a page's guide once, its marker is lime rather than
 * grey — the one nudge, and it goes away for good on first read. Kept in
 * `localStorage` because it is a hint, not data: losing it costs nothing.
 */

const SEEN_KEY = 'wishit.guides.seen';
/** `storage` only fires in *other* tabs, so this tab tells itself. */
const SEEN_EVENT = 'wishit:guide-read';

function readSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function markSeen(guide: string) {
  try {
    const seen = readSeen();
    if (!seen.includes(guide)) {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, guide]));
    }
  } catch {
    /* Private mode, quota, storage switched off — the panel still opens. */
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(SEEN_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(SEEN_EVENT, onChange);
  };
}

/**
 * `localStorage` is an external store, so it is read as one — a `useEffect`
 * that calls `setState` would be a second render on every page load. The server
 * snapshot is `false`, which renders the marker in its plain state; the hint
 * lights up on hydration if the guide has never been opened.
 */
function useUnread(guide: GuideKey): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !readSeen().includes(guide),
    () => false,
  );
}

export function PageGuide({
  guide,
  compact = false,
}: {
  guide: GuideKey;
  /** For headings set in the 12px eyebrow rather than at display size. */
  compact?: boolean;
}) {
  // Widened to `Guide`, or the optional sections read as absent on the pages
  // whose literal happens not to declare them.
  const content: Guide = GUIDES[guide];
  const [open, setOpen] = useState(false);
  const unread = useUnread(guide);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  const show = () => {
    setOpen(true);
    markSeen(guide);
  };

  // Escape closes, the page behind does not scroll, and focus moves into the
  // panel so a keyboard reader is not left behind on the trigger.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={show}
        aria-label={`What is the ${content.title} page for?`}
        aria-expanded={open}
        className={`inline-flex shrink-0 cursor-pointer items-center justify-center border align-middle transition-colors duration-[140ms] ${
          compact ? 'size-[18px]' : 'size-6'
        } ${
          unread
            ? 'border-accent text-accent'
            : 'border-line text-ink-faint hover:border-accent hover:text-accent'
        }`}
      >
        <IconInfo size={compact ? 13 : 16} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={`${content.title} — guide`}
            tabIndex={-1}
            className="rise flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-surface shadow-lg outline-none ring-1 ring-line-strong/60 sm:rounded-3xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-line/70 border-t-2 border-t-accent bg-surface-lift/60 px-5 py-4">
              <div>
                <p className="eyebrow text-[11px]">Guide</p>
                <h2 className="mt-1.5 font-display text-[24px] leading-none">
                  {content.title}
                </h2>
                <p className="mt-2 max-w-prose text-[14px] text-ink-soft">
                  {content.tagline}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="-mr-1 -mt-1 cursor-pointer p-1.5 text-ink-faint transition-colors duration-[140ms] hover:bg-surface hover:text-ink"
              >
                <IconClose size={18} />
              </button>
            </header>

            <div className="overflow-y-auto px-5 py-5">
              <Section label="What this page is">
                {content.what.map((para) => (
                  <p key={para} className="text-[15px] leading-relaxed text-ink">
                    {para}
                  </p>
                ))}
              </Section>

              {content.notThis && content.notThis.length > 0 && (
                <Section label="Not the same as">
                  <ul className="divide-y divide-line/70">
                    {content.notThis.map((row) => (
                      <li key={row.href} className="py-3">
                        <Link
                          href={row.href}
                          onClick={close}
                          className="inline-flex items-center gap-1.5 text-[15px] font-medium text-accent"
                        >
                          {row.page}
                          <IconArrowRight size={13} />
                        </Link>
                        <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
                          {row.line}
                        </p>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              <Section label="Walk through an example">
                <p className="rounded-r-xl border-l-2 border-l-accent bg-surface-lift px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-soft">
                  {content.example.setup}
                </p>
                <ol className="mt-4 space-y-4">
                  {content.example.steps.map((step, i) => (
                    <li key={step.action} className="flex gap-3.5">
                      <span className="tnum mt-0.5 flex size-5 shrink-0 items-center justify-center border border-line-strong text-[12px] font-semibold text-ink-faint">
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-medium text-ink">
                          {step.action}
                        </span>
                        <span className="mt-1 block text-[14px] leading-relaxed text-ink-soft">
                          {step.result}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 rounded-xl bg-surface-lift px-3.5 py-3 text-[14px] leading-relaxed text-ink">
                  <span className="eyebrow mr-2 text-[11px]">In short</span>
                  {content.example.takeaway}
                </p>
              </Section>

              {content.notes && content.notes.length > 0 && (
                <Section label="Worth knowing">
                  <ul className="space-y-2.5">
                    {content.notes.map((note) => (
                      <li
                        key={note}
                        className="flex gap-2.5 text-[14px] leading-relaxed text-ink-soft"
                      >
                        <span aria-hidden className="mt-[7px] size-1 shrink-0 bg-accent" />
                        {note}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>

            <footer className="border-t border-line/70 px-5 py-3 text-right">
              <button
                type="button"
                onClick={close}
                className="cursor-pointer border border-line-strong px-4 py-2 text-[14px] font-medium uppercase tracking-[0.06em] text-ink transition-all duration-[140ms] hover:border-accent hover:text-accent"
              >
                Got it
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

/** A labelled block. Spacing lives here so the panel body stays readable. */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 space-y-3 first:mt-0">
      <h3 className="eyebrow text-[11px]">{label}</h3>
      {children}
    </section>
  );
}
