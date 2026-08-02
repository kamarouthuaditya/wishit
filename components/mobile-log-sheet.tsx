'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { addTransaction } from '@/lib/actions';
import { inr } from '@/lib/format';
import { IconPlus } from '@/components/icons';

/**
 * Log a spend, fifteen seconds, one thumb.
 *
 * The FAB on the mobile tab bar opens this instead of navigating anywhere —
 * it is an action, not a destination. Everything actionable sits in the
 * bottom two-thirds of the screen, because a sheet that makes you reach to
 * the top of the phone for the one field you actually need has already lost
 * the fifteen seconds it was supposed to save.
 *
 * The keypad is mounted with the sheet, not summoned by focusing the amount
 * field: this is the one screen in the product where the keyboard *is* the
 * content, so there is nothing to switch away from and back to.
 */
export function MobileLogSheet({
  recentCategories,
  categoryBudgets,
  today,
  monthTitle,
}: {
  /** Most recent distinct categories first, capped at four. */
  recentCategories: string[];
  /** What each category still has to spend this month, if it has a budget. */
  categoryBudgets: Record<string, { budget: number; logged: number }>;
  today: string;
  monthTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(recentCategories[0] ?? '');
  const [note, setNote] = useState('');
  const [customCategory, setCustomCategory] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const amountNum = Number(amount) || 0;

  const consequence = useMemo(() => {
    if (!category || amountNum <= 0) return null;
    const line = categoryBudgets[category];
    if (!line) return `Nothing else changes.`;
    const projected = line.logged + amountNum;
    const over = projected - line.budget;
    return over > 0
      ? `Puts ${monthTitle} ${inr(over)} further over budget. Nothing else changes.`
      : `Keeps ${monthTitle} ${inr(Math.abs(over))} under budget. Nothing else changes.`;
  }, [amountNum, category, categoryBudgets, monthTitle]);

  const press = (key: string) => {
    if (key === '⌫') {
      setAmount((a) => a.slice(0, -1));
      return;
    }
    if (key === '.' && amount.includes('.')) return;
    // Two decimal places is a rupee's worth of precision; a third digit after
    // the point is not a paisa anyone types on purpose.
    if (amount.includes('.') && amount.split('.')[1]?.length >= 2) return;
    setAmount((a) => (a === '0' ? key : a + key));
  };

  const close = () => {
    setOpen(false);
    setAmount('');
    setNote('');
    setCustomCategory(false);
    setCategory(recentCategories[0] ?? '');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Log a spend"
        aria-haspopup="dialog"
        style={{ borderRadius: '9999px' }}
        className="-mt-[27px] flex size-14 cursor-pointer items-center justify-center border border-accent bg-paper text-accent shadow-md transition-transform active:scale-95"
      >
        <IconPlus size={24} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Log a spend"
          className="fixed inset-0 z-[70] flex flex-col justify-end"
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-ink/50"
            onClick={close}
          />

          <div className="rise relative flex max-h-[85vh] flex-col border-t border-line-strong bg-surface pb-[env(safe-area-inset-bottom)]">
            <div className="flex justify-center pt-2.5">
              <span aria-hidden className="h-[3px] w-9 bg-line-strong" />
            </div>

            <div className="flex items-baseline justify-between px-6 pt-3">
              <h2 className="font-display text-[20px] leading-none">Log a spend</h2>
              <span className="text-[14px] text-ink-faint">
                Today, {CLOCK.format(new Date())}
              </span>
            </div>

            <form
              ref={formRef}
              action={async (formData) => {
                if (amountNum <= 0) return;
                await addTransaction(formData);
                close();
              }}
              className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 pt-5"
            >
              <input type="hidden" name="date" value={today} />
              <input type="hidden" name="amount" value={amount} />
              <input type="hidden" name="category" value={category} />

              <p className="tnum text-center font-display text-[64px] leading-none">
                ₹{amount || '0'}
              </p>

              <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
                {recentCategories.map((c, i) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCategory(c);
                      setCustomCategory(false);
                    }}
                    className={`shrink-0 whitespace-nowrap border px-3.5 py-1.5 text-[14px] transition-colors ${
                      !customCategory && category === c
                        ? 'border-accent text-accent'
                        : 'border-line-strong text-ink-soft'
                    }`}
                  >
                    {i === 0 ? c : c}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCustomCategory(true)}
                  className={`shrink-0 whitespace-nowrap border px-3.5 py-1.5 text-[14px] transition-colors ${
                    customCategory ? 'border-accent text-accent' : 'border-line-strong text-ink-soft'
                  }`}
                >
                  Other
                </button>
              </div>

              {customCategory && (
                <input
                  autoFocus
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Category"
                  aria-label="Category"
                  className="mt-3 w-full border border-line bg-paper px-3 py-2 text-[15px] outline-none focus:border-accent"
                />
              )}

              <input
                name="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note — optional"
                aria-label="Note"
                className="mt-3 w-full border border-line bg-paper px-3 py-2.5 text-[15px] outline-none focus:border-accent"
              />

              <div className="mt-4 grid grid-cols-3 gap-px border border-line bg-line">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => press(key)}
                    className="tnum flex h-[56px] cursor-pointer items-center justify-center bg-paper text-[22px] transition-colors active:bg-surface-lift"
                  >
                    {key}
                  </button>
                ))}
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={close}
                  className="cursor-pointer border border-line-strong px-5 py-3 text-[14px] font-medium uppercase tracking-[0.06em] text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={amountNum <= 0 || !category}
                  className="flex-1 cursor-pointer border border-accent-edge bg-accent-fill px-4 py-3 text-[15px] font-bold text-on-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Log {inr(amountNum)}
                  {category ? ` to ${category}` : ''}
                </button>
              </div>

              {consequence && (
                <p className="mt-3 text-center text-[13px] text-ink-faint">{consequence}</p>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const CLOCK = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });
