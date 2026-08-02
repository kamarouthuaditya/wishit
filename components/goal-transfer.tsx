'use client';

import { useState } from 'react';
import { transferBetweenGoals } from '@/lib/actions';
import { planTransfer, type TransferParty } from '@/lib/model/transfer';
import { inr } from '@/lib/format';
import { Button, Field, Input, Select } from '@/components/ui';

/**
 * "Buy the laptop out of the emergency fund." Moves money that is already
 * saved from one goal to another.
 *
 * The consequence is shown before the button is pressed, not after: taking
 * ₹50,000 out of a protected fund is a decision, and the number it leaves
 * behind is the thing you want to see while deciding. Everything is recomputed
 * from the same rule the server applies, so the preview cannot drift from what
 * actually happens.
 */
export function GoalTransfer({
  destination,
  sources,
}: {
  destination: TransferParty;
  /** Other goals with something in them. Empty means nothing to draw on. */
  sources: TransferParty[];
}) {
  const [fromId, setFromId] = useState(sources[0]?.id ?? '');
  const [amount, setAmount] = useState('');

  if (sources.length === 0) return null;

  const from = sources.find((s) => s.id === fromId) ?? sources[0];
  const requested = Number(amount);
  const plan = planTransfer(from, destination, requested);
  const stillNeeded = Math.max(0, destination.target - destination.balance);

  return (
    <div className="mt-3 rounded-lg border border-line bg-paper p-4">
      <form
        action={transferBetweenGoals}
        className="grid items-end gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]"
      >
        <input type="hidden" name="to_id" value={destination.id} />
        <Field label="Draw from another goal">
          <Select
            name="from_id"
            value={fromId}
            onChange={(event) => setFromId(event.target.value)}
          >
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name} — {inr(source.balance)} saved
                {source.isProtected ? ' · protected' : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount">
          <Input
            name="amount"
            type="number"
            step="1"
            min={1}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={String(Math.round(Math.min(from.balance, stillNeeded)))}
          />
        </Field>
        <div className="pb-1">
          <Button variant="ghost" type="submit" disabled={plan.blocked}>
            Transfer
          </Button>
        </div>
      </form>

      {plan.blocked ? (
        <p className="mt-2 text-[13px] text-ink-faint">
          {plan.warnings[0] ??
            'Moves money already saved. Your total savings do not change — only what they are earmarked for.'}
        </p>
      ) : (
        <div className="mt-3 space-y-1 text-[14px]">
          <p className="text-ink-soft">
            {inr(plan.amount)} moves across:{' '}
            <strong>{destination.name}</strong> becomes {inr(plan.toAfter)} of{' '}
            {inr(destination.target)}, <strong>{from.name}</strong> drops to{' '}
            {inr(plan.fromAfter)}.
          </p>
          {plan.clamped === 'insufficient' && (
            <p className="text-ink-faint">
              {from.name} only has {inr(from.balance)}, so that is all that can move.
            </p>
          )}
          {plan.clamped === 'target-reached' && (
            <p className="text-ink-faint">
              Capped at the {inr(stillNeeded)} {destination.name} still needs.
            </p>
          )}
          {plan.warnings.map((warning) => (
            <p key={warning} className="text-warn">
              {warning}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
