'use client';

import { useState, type ReactNode } from 'react';
import { deleteWishlistItem, saveWishlistItem } from '@/lib/actions';
import { Button, Field, Input, Select } from '@/components/ui';
import { ConfirmButton } from '@/components/confirm-button';
import type { PurchaseMode, WishlistItemRow } from '@/lib/db/types';

/**
 * What the thing is, how it gets paid for, and where it stands.
 *
 * Those are three separate questions and the form used to ask all twelve of
 * their fields as one flat four-column grid, so "Tenure (months)" sat at the
 * same width and weight as "Reason", and a checkbox occupied a cell as though
 * it were a field. Nothing said which fields moved together.
 *
 * The payment fields are now *absent* rather than disabled when they do not
 * apply. Cash showed five greyed-out controls — EMI amount, tenure, down
 * payment, monthly saving, rate — which is a form asking five questions it has
 * already decided are irrelevant. Unmounting keeps the behaviour that made them
 * disabled in the first place: an absent field is not submitted, so switching
 * from EMI to cash still clears the EMI figures instead of leaving stale numbers
 * the engine ignores but the user can still read.
 */

interface FieldRules {
  emi: boolean;
  downPayment: boolean;
  monthlySaving: boolean;
  rate: boolean;
}

function rulesFor(mode: PurchaseMode): FieldRules {
  switch (mode) {
    case 'cash':
      return { emi: false, downPayment: false, monthlySaving: false, rate: false };
    case 'emi':
      return { emi: true, downPayment: false, monthlySaving: false, rate: true };
    case 'down-payment-emi':
      return { emi: true, downPayment: true, monthlySaving: false, rate: true };
    case 'save-then-buy':
      return { emi: false, downPayment: false, monthlySaving: true, rate: false };
  }
}

const MODE_NOTE: Record<PurchaseMode, string> = {
  cash: 'Paid in full from your savings, in one go.',
  emi: 'Fixed instalments. Nothing leaves your savings upfront.',
  'down-payment-emi': 'Part upfront from savings, the rest in instalments.',
  'save-then-buy': 'Set money aside each month, buy once it adds up.',
};

/** A named run of fields. The heading is what says they belong together. */
function Group({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="border-t border-line pt-4 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="section-title text-[13px]">{title}</h3>
        {note && <p className="text-[13px] text-ink-faint">{note}</p>}
      </div>
      <div className="mt-3 grid gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        {children}
      </div>
    </fieldset>
  );
}

export function WishlistItemForm({
  item,
  onSaved,
}: {
  item?: WishlistItemRow;
  /** Called once the write lands — the add dialog closes on it. */
  onSaved?: () => void;
}) {
  const [mode, setMode] = useState<PurchaseMode>(item?.purchase_mode ?? 'cash');
  const [noCost, setNoCost] = useState<boolean>(item?.is_no_cost ?? false);

  const rules = rulesFor(mode);
  // A no-cost EMI is interest-free by definition, so the rate is not yours to set.
  const rateShown = rules.rate && !noCost;

  return (
    <form
      action={async (formData) => {
        await saveWishlistItem(formData);
        onSaved?.();
      }}
      className="space-y-5"
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      {/*
        The action writes `category` on every save, and no control here has ever
        set it, so editing an item quietly reset it to `general` — the same was
        true of priority and the target date until they became fields below.
      */}
      <input type="hidden" name="category" value={item?.category ?? 'general'} />

      <Group title="The thing">
        <div className="sm:col-span-2">
          <Field label="Name">
            <Input
              name="name"
              defaultValue={item?.name}
              placeholder="AirPods"
              required
            />
          </Field>
        </div>
        <Field label="Price" hint="What it costs today">
          <Input
            name="price"
            type="number"
            step="1"
            inputMode="numeric"
            defaultValue={item ? Number(item.price) : ''}
            placeholder="29400"
            required
          />
        </Field>
        <Field label="Reason" hint="What it is for, in a few words">
          <Input
            name="reason"
            defaultValue={item?.reason ?? ''}
            placeholder="Why this purchase?"
          />
        </Field>
      </Group>

      <Group title="How you pay for it" note={MODE_NOTE[mode]}>
        <div className="sm:col-span-2">
          <Field label="Payment method">
            <Select
              name="purchase_mode"
              value={mode}
              onChange={(event) => setMode(event.target.value as PurchaseMode)}
            >
              <option value="cash">Pay in full now</option>
              <option value="emi">EMI</option>
              <option value="down-payment-emi">Down payment + EMI</option>
              <option value="save-then-buy">Save up, then buy</option>
            </Select>
          </Field>
        </div>

        {rules.downPayment && (
          <Field label="Down payment" hint="Paid from savings upfront">
            <Input
              name="down_payment"
              type="number"
              step="1"
              defaultValue={
                item?.down_payment != null ? Number(item.down_payment) : ''
              }
            />
          </Field>
        )}

        {rules.emi && (
          <>
            <Field label="EMI amount" hint="Per month">
              <Input
                name="emi_amount"
                type="number"
                step="1"
                defaultValue={item?.emi_amount != null ? Number(item.emi_amount) : ''}
              />
            </Field>
            <Field label="Tenure" hint="Months">
              <Input
                name="emi_tenure"
                type="number"
                min={1}
                defaultValue={item?.emi_tenure ?? ''}
              />
            </Field>
          </>
        )}

        {rules.monthlySaving && (
          <Field label="Monthly saving" hint="Set aside until it adds up">
            <Input
              name="monthly_saving"
              type="number"
              step="1"
              defaultValue={
                item?.monthly_saving != null ? Number(item.monthly_saving) : ''
              }
            />
          </Field>
        )}

        {rateShown && (
          <Field label="Interest rate (%)" hint="Per year. 0 if interest-free.">
            <Input
              name="annual_rate_pct"
              type="number"
              step="0.1"
              defaultValue={item ? Number(item.annual_rate_pct) : 0}
            />
          </Field>
        )}

        {rules.rate && (
          <label className="flex items-center gap-2 self-end pb-2 text-[15px]">
            <input
              type="checkbox"
              name="is_no_cost"
              className="size-4 accent-[var(--accent)]"
              checked={noCost}
              onChange={(event) => setNoCost(event.target.checked)}
            />
            No-cost EMI
          </label>
        )}
      </Group>

      <Group title="Where it stands">
        <Field label="Status" hint="Only committed items enter your projections">
          <Select name="status" defaultValue={item?.status ?? 'idea'}>
            <option value="idea">Idea</option>
            <option value="planned">Considering</option>
            <option value="committed">Committed</option>
            <option value="purchased">Purchased</option>
            <option value="dropped">Dropped</option>
          </Select>
        </Field>
        <Field label="Priority" hint="1 is highest">
          <Input
            name="priority"
            type="number"
            min={1}
            defaultValue={item?.priority ?? 3}
          />
        </Field>
        <Field label="Wanted by" hint="Blank means no date in mind">
          <Input
            name="target_date"
            type="date"
            defaultValue={item?.target_date?.slice(0, 10) ?? ''}
          />
        </Field>
        <Field label="Buy in month" hint="Blank means as soon as it fits">
          <Input
            name="purchase_month"
            type="number"
            min={1}
            defaultValue={item?.purchase_month ?? ''}
          />
        </Field>
      </Group>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button type="submit" size={item ? 'sm' : 'md'}>
          {item ? 'Save' : 'Add item'}
        </Button>
        {item && (
          <ConfirmButton
            action={deleteWishlistItem}
            id={item.id}
            confirm={`Delete ${item.name}? Its scenario history goes with it.`}
          />
        )}
      </div>
    </form>
  );
}
