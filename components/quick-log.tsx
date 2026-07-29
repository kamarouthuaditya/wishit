'use client';

import { useEffect, useRef, useState } from 'react';
import { LogForm } from '@/components/log-form';
import { IconClose, IconPlus } from '@/components/icons';
import { Button } from '@/components/ui';

/**
 * The one action, always within reach.
 *
 * Logging a spend was a panel halfway down the dashboard, which meant the thing
 * you do daily lived where you had to go looking for it, while things you do
 * monthly sat above it. It is now a button in the header — the only lime block
 * in the chrome — and it opens over whatever page you are on, so a spend can be
 * logged from the loans page as easily as from the dashboard.
 *
 * A panel rather than a modal: it is anchored to the button, dismisses on
 * Escape or an outside click, and never blocks the page underneath.
 */
export function QuickLog({
  categories,
  cards,
  today,
}: {
  categories: string[];
  cards: { id: string; name: string }[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onClick = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative">
      <Button
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="px-3 py-1.5 text-[12px]"
      >
        <IconPlus size={14} />
        Log
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Log a spend"
          className="rise absolute right-0 top-[calc(100%+0.6rem)] z-50 w-[min(26rem,calc(100vw-2.5rem))] border border-line-strong bg-surface p-4 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)]"
        >
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="eyebrow">Log a spend</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer text-ink-faint transition-colors hover:text-ink"
              aria-label="Close"
            >
              <IconClose size={15} />
            </button>
          </div>

          <LogForm
            categories={categories}
            defaultDate={today}
            cards={cards}
            listId="wishit-quick-categories"
          />
        </div>
      )}
    </div>
  );
}
