'use client';

import { Button } from '@/components/ui';
import { CategorySelect } from '@/components/category-select';
import { useRef, useState } from 'react';
import { saveExpense } from '@/lib/actions';
import { IconPlus } from '@/components/icons';
import { isoDate } from '@/lib/format';

/** One control's box: the field treatment, minus the label a `Field` adds. */
const control =
  'rounded-xl border border-line bg-paper px-3.5 py-2.5 text-ink outline-none ' +
  'transition-all duration-[140ms] hover:border-line-strong focus:border-accent focus:shadow-[0_0_0_4px_var(--accent-dim)] ' +
  'placeholder:text-ink-faint';

/**
 * Adding an expense, pinned to the bottom of the page.
 *
 * The sticky slot used to hold a running-balance widget: a number you could
 * already read in the header, in the one place where the thing you actually
 * came to do — add a line — was buried at the end of a long list. The slot now
 * holds the action.
 *
 * Four fields fit the sentence "Rent, ₹25,000, monthly, fixed". Card, category
 * and dates are real but rare, so they sit behind one toggle rather than
 * widening the row to eight controls.
 */
export function ExpenseComposer({
  cards,
  categories,
}: {
  cards: { id: string; name: string }[];
  categories: string[];
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  return (
    <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 -mx-5 border-t border-line bg-paper px-5 py-4 md:bottom-0">
      <form
        ref={formRef}
        action={async (formData) => {
          await saveExpense(formData);
          formRef.current?.reset();
          setOpen(false);
          nameRef.current?.focus();
        }}
        className="mx-auto max-w-[1440px] space-y-3"
      >
        <p className="eyebrow">New line</p>

        {/*
          Separate bordered controls rather than one joined strip of segments
          divided by 1px gaps. In the strip a `select` had no edge of its own,
          so the two dropdowns read as words sitting in the row — the arrow was
          the only clue they could be opened at all. Each control owns its box
          now, and the selects keep the platform's own arrow and popup.
        */}
        <div className="flex flex-wrap items-stretch gap-2">
          <input
            ref={nameRef}
            name="name"
            required
            placeholder="Rent, Gym, Netflix…"
            aria-label="What it is"
            className={`${control} min-w-[9rem] flex-[1.4] text-[16px]`}
          />

          <div
            className={`${control} flex min-w-[7rem] flex-1 items-center gap-2 px-3 py-0`}
          >
            <span aria-hidden className="text-[16px] text-ink-faint">
              ₹
            </span>
            <input
              name="amount"
              type="number"
              step="1"
              inputMode="numeric"
              required
              placeholder="0"
              aria-label="Amount per bill"
              className="tnum w-full bg-transparent py-2.5 text-[17px] font-medium outline-none placeholder:text-ink-faint"
            />
          </div>

          <select
            name="frequency_months"
            defaultValue="1"
            aria-label="How often"
            className={`${control} min-w-[8rem] text-[15px]`}
          >
            <option value="1">monthly</option>
            <option value="3">quarterly</option>
            <option value="6">half-yearly</option>
            <option value="12">yearly</option>
          </select>

          <select
            name="type"
            defaultValue="fixed"
            aria-label="Kind"
            className={`${control} min-w-[8rem] text-[15px]`}
          >
            <option value="fixed">fixed</option>
            <option value="variable">variable</option>
          </select>

          <Button type="submit" className="px-5">
            <IconPlus size={15} />
            Add
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
          <button
            type="button"
            onClick={() => setOpen((shown) => !shown)}
            aria-expanded={open}
            className="cursor-pointer text-ink-faint transition-colors duration-[140ms] hover:text-accent"
          >
            {open ? 'Hide category, card and dates' : 'Category, card, start date'}
          </button>

          {open && (
            <div className="rise flex flex-wrap items-center gap-x-3 gap-y-2">
              <CategorySelect
                categories={categories}
                className="mt-0 min-w-[9rem] py-1 text-[13px]"
              />
              <select
                name="paid_by_card_id"
                defaultValue=""
                aria-label="Paid from"
                className="rounded-lg border border-line bg-paper px-2.5 py-1 text-[13px] text-ink outline-none transition-colors duration-[140ms] hover:border-line-strong focus:border-accent"
              >
                <option value="">bank account</option>
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-ink-faint">
                from
                <input
                  name="effective_from"
                  type="date"
                  defaultValue={isoDate()}
                  className="rounded-lg border border-line bg-paper px-2.5 py-1 text-[13px] text-ink outline-none focus:border-accent"
                />
              </label>
            </div>
          )}

          {!open && (
            <span className="text-ink-faint/70">
              Starts today, paid from your bank account.
            </span>
          )}
        </div>

      </form>
    </div>
  );
}
