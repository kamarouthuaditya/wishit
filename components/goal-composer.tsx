'use client';

import { Button } from '@/components/ui';
import { useRef, useState } from 'react';
import { saveGoal } from '@/lib/actions';
import { IconPlus } from '@/components/icons';

/**
 * Adding a goal, pinned to the bottom of the page.
 *
 * Same reasoning as the expense composer: the action you came for should not be
 * the thing you scroll past six goal cards to reach. Name and target are the
 * sentence; a date and a priority are refinements, so they wait behind a
 * toggle.
 */
/** One control's box. Matches the expense composer, deliberately. */
const control =
  'border border-line bg-paper px-3 py-3 text-ink outline-none ' +
  'transition-colors duration-[140ms] hover:border-line-strong focus:border-accent ' +
  'placeholder:text-ink-faint';

export function GoalComposer() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  return (
    <div className="sticky bottom-14 z-10 -mx-5 border-t border-line bg-paper px-5 py-4 md:bottom-0">
      <form
        ref={formRef}
        action={async (formData) => {
          await saveGoal(formData);
          formRef.current?.reset();
          setOpen(false);
          nameRef.current?.focus();
        }}
        className="mx-auto max-w-6xl space-y-3"
      >
        <p className="eyebrow">New goal</p>

        <div className="flex flex-wrap items-stretch gap-2">
          <input
            ref={nameRef}
            name="name"
            required
            placeholder="Emergency fund, laptop, trip…"
            aria-label="What you are saving for"
            className={`${control} min-w-[10rem] flex-[1.6] text-[15px]`}
          />

          <div
            className={`${control} flex min-w-[8rem] flex-1 items-center gap-2 py-0`}
          >
            <span aria-hidden className="text-[15px] text-ink-faint">
              ₹
            </span>
            <input
              name="target"
              type="number"
              step="1"
              inputMode="numeric"
              required
              placeholder="target"
              aria-label="Target amount"
              className="tnum w-full bg-transparent py-3 text-[16px] font-medium outline-none placeholder:text-ink-faint"
            />
          </div>

          <Button
            type="submit"
            className="px-5 py-3 text-[13px]"
          >
            <IconPlus size={15} />
            Add goal
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
          <button
            type="button"
            onClick={() => setOpen((shown) => !shown)}
            aria-expanded={open}
            className="cursor-pointer text-ink-faint transition-colors duration-[140ms] hover:text-accent"
          >
            {open ? 'Hide the details' : 'Saved so far, target date, priority'}
          </button>

          {open && (
            <div className="rise flex flex-wrap items-center gap-x-3 gap-y-2 text-ink-faint">
              <label className="flex items-center gap-2">
                saved
                <input
                  name="current_amount"
                  type="number"
                  step="1"
                  defaultValue={0}
                  className="tnum w-24 border border-line bg-paper px-2 py-1 text-[12px] text-ink outline-none focus:border-accent"
                />
              </label>
              <label className="flex items-center gap-2">
                by
                <input
                  name="deadline"
                  type="date"
                  className="border border-line bg-paper px-2 py-1 text-[12px] text-ink outline-none focus:border-accent"
                />
              </label>
              <label className="flex items-center gap-2">
                priority
                <input
                  name="priority"
                  type="number"
                  min={1}
                  defaultValue={1}
                  className="tnum w-14 border border-line bg-paper px-2 py-1 text-[12px] text-ink outline-none focus:border-accent"
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  name="is_protected"
                  className="size-3.5 accent-[var(--accent)]"
                />
                Protected
              </label>
            </div>
          )}

          {!open && (
            <span className="text-ink-faint/70">
              Funded from what is left, in priority order, until it is full.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
