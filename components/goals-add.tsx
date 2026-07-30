'use client';

import { useRef, useState } from 'react';
import { saveExpense, saveGoal } from '@/lib/actions';
import { Button, Field, Input, Select } from '@/components/ui';
import { CategorySelect } from '@/components/category-select';
import { Dialog } from '@/components/dialog';
import { IconPlus } from '@/components/icons';
import { isoDate } from '@/lib/format';

/**
 * The two things this page adds, and the forms that add them properly.
 *
 * A goal used to arrive from a two-field strip: a name and a target, with the
 * date, the priority, the protection flag and the expected return all left at
 * their defaults. Every one of those is a decision the person adding the goal
 * has already made — they know it is the emergency fund, they know it comes
 * first — so defaulting them silently meant opening the goal straight after
 * adding it to say what they already knew. The strip was quick to look at and
 * slow to use.
 *
 * So: two buttons, each opening the whole form. Everything is still editable on
 * the row afterwards; nothing has to be.
 */

const FREQUENCIES = [
  { value: '1', label: 'Monthly' },
  { value: '3', label: 'Quarterly' },
  { value: '6', label: 'Half-yearly' },
  { value: '12', label: 'Yearly' },
];

type Which = 'goal' | 'saving' | null;

export function GoalsAdd({
  categories,
  nextPriority,
}: {
  categories: string[];
  /** One past the lowest-ranked goal, so a new one lands at the bottom. */
  nextPriority: number;
}) {
  const [open, setOpen] = useState<Which>(null);
  const goalForm = useRef<HTMLFormElement>(null);
  const savingForm = useRef<HTMLFormElement>(null);

  const close = () => setOpen(null);

  return (
    <div className="sticky bottom-14 z-10 -mx-5 border-t border-line bg-paper px-5 py-3 md:bottom-0">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
        <Button type="button" onClick={() => setOpen('goal')}>
          <IconPlus size={15} />
          New goal
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen('saving')}>
          <IconPlus size={15} />
          New saving line
        </Button>
        <span className="text-[12px] text-ink-faint">
          A goal is a thing you are saving up for. A saving line is money
          committed every month, before anything is left over.
        </span>
      </div>

      <Dialog
        open={open === 'goal'}
        onClose={close}
        title="New goal"
        hint="Everything here is editable on the goal afterwards. Filling it in now saves opening it again."
      >
        <form
          ref={goalForm}
          action={async (formData) => {
            await saveGoal(formData);
            goalForm.current?.reset();
            close();
          }}
          className="grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Field label="Name">
            <Input
              name="name"
              required
              autoFocus
              placeholder="Emergency fund, laptop, trip…"
            />
          </Field>
          <Field label="Target">
            <Input
              name="target"
              type="number"
              step="1"
              inputMode="numeric"
              required
              placeholder="0"
            />
          </Field>
          <Field label="Saved so far" hint="What is already set aside for it">
            <Input name="current_amount" type="number" step="1" defaultValue={0} />
          </Field>

          <Field label="Target date" hint="Sets the pace it needs">
            <Input name="deadline" type="date" />
          </Field>
          <Field
            label="Monthly contribution"
            hint="Blank funds it from what is left, in priority order"
          >
            <Input name="fixed_contribution" type="number" step="1" placeholder="—" />
          </Field>
          <Field label="Stop funding after" hint="Blank means until it is full">
            <Input name="contribute_until" type="date" />
          </Field>

          <Field label="Priority" hint="1 is highest">
            <Input
              name="priority"
              type="number"
              min={1}
              defaultValue={nextPriority}
            />
          </Field>
          <Field label="Expected return (%)" hint="Per year. 0 is fine.">
            <Input
              name="expected_return_pct"
              type="number"
              step="0.1"
              defaultValue={0}
            />
          </Field>
          <Field label="Weight" hint="Proportional mode only">
            <Input name="weight" type="number" step="0.1" defaultValue={1} />
          </Field>

          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name="stop_at_deadline"
              className="size-4 accent-[var(--accent)]"
            />
            Stop at the target date
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name="is_protected"
              className="size-4 accent-[var(--accent)]"
            />
            Protected — drawn on last
          </label>

          <div className="flex items-end gap-3 lg:col-span-3">
            <Button type="submit">Add goal</Button>
            <button
              type="button"
              onClick={close}
              className="cursor-pointer text-[12px] text-ink-faint transition-colors duration-[140ms] hover:text-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={open === 'saving'}
        onClose={close}
        title="New saving line"
        hint="A SIP, a recurring deposit, an annual premium. Committed before the balance is worked out."
      >
        <form
          ref={savingForm}
          action={async (formData) => {
            await saveExpense(formData);
            savingForm.current?.reset();
            close();
          }}
          className="grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <input type="hidden" name="type" value="investment" />

          <Field label="Name">
            <Input
              name="name"
              required
              autoFocus
              placeholder="Index SIP, recurring deposit…"
            />
          </Field>
          <Field label="Amount per instalment" hint="What leaves each time, not per month">
            <Input
              name="amount"
              type="number"
              step="1"
              inputMode="numeric"
              required
              placeholder="0"
            />
          </Field>
          <Field label="Billed">
            <Select name="frequency_months" defaultValue="1">
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Category">
            <CategorySelect categories={categories} defaultValue="investment" />
          </Field>
          <Field label="Starts" hint="The month it was last paid, if it is already running">
            <Input name="effective_from" type="date" defaultValue={isoDate()} />
          </Field>
          <Field label="Ends" hint="Blank means it keeps running">
            <Input name="effective_to" type="date" />
          </Field>

          <div className="flex items-end gap-3 lg:col-span-3">
            <Button type="submit">Add saving line</Button>
            <button
              type="button"
              onClick={close}
              className="cursor-pointer text-[12px] text-ink-faint transition-colors duration-[140ms] hover:text-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
