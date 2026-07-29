'use client';

import { Button } from '@/components/ui';
import { useEffect, useRef, useState } from 'react';
import { saveWishlistItem } from '@/lib/actions';
import { IconClose, IconPlus, IconWishlist } from '@/components/icons';

/**
 * "I want that" — captured in the ten seconds you actually want it.
 *
 * The wishlist only works if things reach it while the urge is fresh, and
 * navigating to a page to fill in a form is long enough for the thought to
 * pass. Name and price are the whole capture; everything that decides *how* you
 * would buy it — EMI, saving up, priority — waits on the item's own page, where
 * you are in a different frame of mind.
 *
 * Items land as ideas, which never touch a projection until you commit them.
 */
export function QuickWish() {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

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

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex cursor-pointer items-center gap-1.5 border border-line-strong px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-ink transition-all duration-[140ms] hover:border-accent hover:text-accent active:scale-[0.985]"
      >
        <IconWishlist size={14} />
        <span className="hidden sm:inline">Want</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Add to wishlist"
          className="rise absolute right-0 top-[calc(100%+0.6rem)] z-50 w-[min(24rem,calc(100vw-2.5rem))] border border-line-strong bg-surface p-4 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.9)]"
        >
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="eyebrow">Something you want</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer text-ink-faint transition-colors hover:text-ink"
              aria-label="Close"
            >
              <IconClose size={15} />
            </button>
          </div>

          <form
            ref={formRef}
            action={async (formData) => {
              const name = String(formData.get('name') ?? '');
              await saveWishlistItem(formData);
              formRef.current?.reset();
              setSaved(name);
              nameRef.current?.focus();
            }}
            className="space-y-3"
          >
            <input type="hidden" name="status" value="idea" />
            <input type="hidden" name="purchase_mode" value="cash" />
            <input type="hidden" name="priority" value="3" />

            <div className="flex flex-wrap items-stretch gap-px border border-line bg-line">
              <input
                ref={nameRef}
                name="name"
                required
                autoFocus
                placeholder="AirPods, sofa, trip…"
                aria-label="What you want"
                className="min-w-[8rem] flex-[1.4] bg-paper px-3 py-2.5 text-[15px] outline-none placeholder:text-ink-faint"
              />
              <div className="flex min-w-[6.5rem] flex-1 items-center gap-2 bg-paper px-3">
                <span aria-hidden className="text-ink-faint">
                  ₹
                </span>
                <input
                  name="price"
                  type="number"
                  step="1"
                  inputMode="numeric"
                  required
                  placeholder="0"
                  aria-label="Roughly what it costs"
                  className="tnum w-full bg-transparent py-2.5 text-[16px] font-medium outline-none placeholder:text-ink-faint"
                />
              </div>
              <Button
                type="submit"
                className="px-4 py-2.5 text-[12px]"
              >
                <IconPlus size={14} />
                Add
              </Button>
            </div>

            <p className="text-[12px] leading-snug text-ink-faint">
              {saved
                ? `${saved} saved as an idea. Open it on the wishlist to see what buying it would cost you in time.`
                : 'Saved as an idea: nothing changes in your projections until you commit to it.'}
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
