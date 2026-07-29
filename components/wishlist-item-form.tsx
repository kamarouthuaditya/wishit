'use client';

import { useState } from 'react';
import { deleteWishlistItem, saveWishlistItem } from '@/lib/actions';
import { Button, Field, Input, Select } from '@/components/ui';
import type { PurchaseMode, WishlistItemRow } from '@/lib/db/types';

/**
 * Only the fields that belong to the chosen payment method stay editable.
 *
 * Disabled inputs are not submitted, so switching an item from EMI to cash also
 * clears the EMI figures rather than leaving stale numbers behind that the
 * engine would ignore but the user would still see.
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

export function WishlistItemForm({ item }: { item?: WishlistItemRow }) {
  const [mode, setMode] = useState<PurchaseMode>(item?.purchase_mode ?? 'cash');
  const [noCost, setNoCost] = useState<boolean>(item?.is_no_cost ?? false);

  const rules = rulesFor(mode);
  // A no-cost EMI is interest-free by definition, so the rate is not yours to set.
  const rateDisabled = !rules.rate || noCost;

  return (
    <form action={saveWishlistItem} className="mt-3 space-y-3">
      <div className="grid items-end gap-3 sm:grid-cols-4">
        {item && <input type="hidden" name="id" value={item.id} />}

        <Field label="Name">
          <Input name="name" defaultValue={item?.name} placeholder="AirPods" required />
        </Field>
        <Field label="Price">
          <Input
            name="price"
            type="number"
            defaultValue={item ? Number(item.price) : ''}
            placeholder="29400"
            required
          />
        </Field>
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
        <Field label="Status">
          <Select name="status" defaultValue={item?.status ?? 'idea'}>
            <option value="idea">Idea</option>
            <option value="planned">Considering</option>
            <option value="committed">Committed</option>
            <option value="purchased">Purchased</option>
            <option value="dropped">Dropped</option>
          </Select>
        </Field>

        <Field label="EMI amount" hint="Per month" muted={!rules.emi}>
          <Input
            name="emi_amount"
            type="number"
            disabled={!rules.emi}
            defaultValue={item?.emi_amount != null ? Number(item.emi_amount) : ''}
          />
        </Field>
        <Field label="Tenure (months)" muted={!rules.emi}>
          <Input
            name="emi_tenure"
            type="number"
            disabled={!rules.emi}
            defaultValue={item?.emi_tenure ?? ''}
          />
        </Field>
        <Field label="Down payment" muted={!rules.downPayment}>
          <Input
            name="down_payment"
            type="number"
            disabled={!rules.downPayment}
            defaultValue={item?.down_payment != null ? Number(item.down_payment) : ''}
          />
        </Field>
        <Field label="Monthly saving" muted={!rules.monthlySaving}>
          <Input
            name="monthly_saving"
            type="number"
            disabled={!rules.monthlySaving}
            defaultValue={
              item?.monthly_saving != null ? Number(item.monthly_saving) : ''
            }
          />
        </Field>

        <Field
          label="Interest rate (%)"
          hint={noCost && rules.rate ? 'Interest-free' : 'Leave 0 if interest-free'}
          muted={rateDisabled}
        >
          <Input
            name="annual_rate_pct"
            type="number"
            step="0.1"
            disabled={rateDisabled}
            defaultValue={item ? Number(item.annual_rate_pct) : 0}
          />
        </Field>
        <Field label="Purchase in month" hint="Blank means as soon as possible">
          <Input
            name="purchase_month"
            type="number"
            min={1}
            defaultValue={item?.purchase_month ?? ''}
          />
        </Field>
        <Field label="Reason">
          <Input
            name="reason"
            defaultValue={item?.reason ?? ''}
            placeholder="Why this purchase?"
          />
        </Field>
        <label
          className={`flex items-center gap-2 pb-2 text-[14px] ${
            rules.rate ? '' : 'text-ink-faint'
          }`}
        >
          <input
            type="checkbox"
            name="is_no_cost"
            className="size-4"
            disabled={!rules.rate}
            checked={noCost}
            onChange={(event) => setNoCost(event.target.checked)}
          />
          No-cost EMI
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">{item ? 'Save' : 'Add item'}</Button>
        {item && (
          <Button variant="danger" type="submit" formAction={deleteWishlistItem}>
            Delete
          </Button>
        )}
        <span className="text-[13px] text-ink-faint">{MODE_NOTE[mode]}</span>
      </div>
    </form>
  );
}
