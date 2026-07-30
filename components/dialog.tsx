'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A form that needs the whole screen's attention, in the platform's own dialog.
 *
 * The rule in this codebase is that a modal is usually laziness, and it holds:
 * everything that edits an existing row is a disclosure on that row, because
 * the row is the context. Creating is the case that earns the exception. There
 * is no row to sit under yet, and the alternative — the two-field composer strip
 * that used to live here — bought its brevity by leaving eight fields out, so
 * every goal arrived half-specified and had to be opened and edited immediately
 * afterwards. That is friction moved, not removed.
 *
 * `<dialog>` rather than a div with a z-index: focus trapping, `Esc`, the top
 * layer and `aria-modal` all come from the platform, and the top layer is the
 * only way to be certain the sticky bars underneath cannot paint over it.
 */
export function Dialog({
  open,
  onClose,
  title,
  hint,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // `showModal` on an already-open dialog throws, hence the guards.
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // `close` fires for Esc and for the close button alike, so the state that
      // opened the dialog is put back in one place.
      onClose={onClose}
      // A click that lands on the dialog element itself is a click on the
      // backdrop: every child sits inside the padding-free body below.
      onClick={(event) => {
        if (event.target === ref.current) ref.current?.close();
      }}
      /*
       * `m-auto` puts it back in the middle. A modal `<dialog>` is centred by
       * the UA stylesheet with `margin: auto` against `inset: 0`, and Tailwind's
       * preflight zeroes `margin` on every element — `::backdrop` included — so
       * the dialog was landing in the top-left corner.
       *
       * The backdrop tints and blurs. Blur is otherwise banned here as
       * decoration; behind a modal it is doing work, pushing a page of live
       * figures far enough back that the form in front is the only thing worth
       * reading. Kept at 3px: enough to defocus, not enough to smear the page
       * into frosted glass.
       */
      className="rise m-auto w-[min(56rem,calc(100vw-2rem))] border border-line-strong bg-surface p-0 text-ink backdrop:bg-[oklch(0_0_0/0.55)] backdrop:backdrop-blur-[3px]"
    >
      <header className="flex items-baseline justify-between gap-4 border-b-2 border-line-strong bg-surface-lift px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="section-title">{title}</h2>
          {hint && (
            <p className="mt-1 max-w-prose text-[12.5px] leading-snug text-ink-faint">
              {hint}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint transition-colors duration-[140ms] hover:text-accent"
        >
          Close
        </button>
      </header>

      <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>
    </dialog>
  );
}
