'use client';

import { Button } from '@/components/ui';
import { useRef, useState } from 'react';
import { addTransaction } from '@/lib/actions';
import { IconPlus } from '@/components/icons';

/**
 * Logging a spend, in one line.
 *
 * The old version was five stacked fields with labels, which is a form you fill
 * in. This is a sentence you complete: amount, what for, and you are done. Date
 * defaults to today and one-off hides behind a toggle, because nine times in
 * ten neither needs touching.
 *
 * Amount comes first because it is the thing you know when you open the app —
 * you just paid it. Focus returns there after every submit, so logging three
 * things in a row never needs the mouse.
 */
export function LogForm({
  categories,
  defaultDate,
  cards = [],
  listId = 'wishit-log-categories',
}: {
  categories: string[];
  defaultDate: string;
  /** Tagging a card moves the money to its due date, not out of your budget. */
  cards?: { id: string; name: string }[];
  listId?: string;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await addTransaction(formData);
        formRef.current?.reset();
        setShowDetail(false);
        amountRef.current?.focus();
      }}
      className="space-y-3"
    >
      <div className="flex flex-wrap items-stretch gap-px border border-line bg-line">
        <div className="flex min-w-[7.5rem] flex-1 items-center gap-2 bg-paper px-3">
          <span aria-hidden className="text-[15px] text-ink-faint">
            ₹
          </span>
          <input
            ref={amountRef}
            name="amount"
            type="number"
            step="1"
            inputMode="numeric"
            required
            placeholder="0"
            aria-label="Amount"
            className="tnum w-full bg-transparent py-3 text-[17px] font-medium outline-none placeholder:text-ink-faint"
          />
        </div>

        <input
          name="category"
          list={listId}
          required
          placeholder="what for"
          aria-label="Category"
          className="min-w-[8rem] flex-[1.2] bg-paper px-3 py-3 text-[15px] outline-none placeholder:text-ink-faint"
        />

        <Button
          type="submit"
          className="px-5 py-3 text-[13px]"
        >
          <IconPlus size={15} />
          Log
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
        <button
          type="button"
          onClick={() => setShowDetail((shown) => !shown)}
          aria-expanded={showDetail}
          className="cursor-pointer text-ink-faint transition-colors duration-[140ms] hover:text-accent"
        >
          {showDetail ? 'Hide date and note' : 'Add date, note, or mark one-off'}
        </button>

        {showDetail && (
          <div className="rise flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 text-ink-faint">
              Date
              <input
                name="date"
                type="date"
                defaultValue={defaultDate}
                className="border border-line bg-paper px-2 py-1 text-[12px] text-ink outline-none focus:border-accent"
              />
            </label>
            <input
              name="note"
              placeholder="note"
              aria-label="Note"
              className="border border-line bg-paper px-2 py-1 text-[12px] outline-none placeholder:text-ink-faint focus:border-accent"
            />
            {cards.length > 0 && (
              <label className="flex items-center gap-2 text-ink-faint">
                Paid with
                <select
                  name="paid_by_card_id"
                  defaultValue=""
                  className="border border-line bg-paper px-2 py-1 text-[12px] text-ink outline-none focus:border-accent"
                >
                  <option value="">bank account</option>
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-ink-faint">
              <input type="checkbox" name="is_one_off" className="size-3.5 accent-[var(--accent)]" />
              One-off
            </label>
          </div>
        )}

        {!showDetail && (
          <span className="text-ink-faint/70">Dated today unless you say otherwise.</span>
        )}
      </div>

      <datalist id={listId}>
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </form>
  );
}
