/**
 * Moving money that is already saved from one goal to another.
 *
 * Goal balances are buckets inside the same corpus, so a transfer never changes
 * how much money you have — only what it is earmarked for. That is why nothing
 * here touches the corpus or the emergency floor.
 */

export interface TransferParty {
  id: string;
  name: string;
  /** Saved so far. */
  balance: number;
  target: number;
  isProtected: boolean;
}

export interface TransferPlan {
  /** What will actually move, after clamping. */
  amount: number;
  fromAfter: number;
  toAfter: number;
  /** Set when the requested amount could not move in full. */
  clamped: 'insufficient' | 'target-reached' | null;
  /** Things worth saying out loud before the button is pressed. */
  warnings: string[];
  /** True when there is nothing sensible to transfer. */
  blocked: boolean;
}

export function planTransfer(
  from: TransferParty,
  to: TransferParty,
  requested: number,
): TransferPlan {
  const empty: TransferPlan = {
    amount: 0,
    fromAfter: from.balance,
    toAfter: to.balance,
    clamped: null,
    warnings: [],
    blocked: true,
  };

  if (from.id === to.id) return empty;
  if (!Number.isFinite(requested) || requested <= 0) return empty;
  if (from.balance <= 0) return empty;

  // Never move more than is there, and never more than the destination still
  // needs — money parked past a goal's target is money doing nothing.
  const stillNeeded = Math.max(0, to.target - to.balance);
  let amount = Math.min(requested, from.balance);
  let clamped: TransferPlan['clamped'] = amount < requested ? 'insufficient' : null;

  if (stillNeeded > 0 && amount > stillNeeded) {
    amount = stillNeeded;
    clamped = 'target-reached';
  }
  if (stillNeeded === 0) return { ...empty, warnings: [`${to.name} has already reached its target.`] };

  const fromAfter = from.balance - amount;
  const warnings: string[] = [];

  if (from.isProtected) {
    warnings.push(
      `${from.name} is protected — it is meant to be drawn on last, not first.`,
    );
  }
  if (fromAfter < from.target) {
    warnings.push(
      from.balance >= from.target
        ? `This takes ${from.name} back under its target.`
        : `${from.name} is already short of its target; this leaves it further behind.`,
    );
  }
  if (fromAfter === 0) {
    warnings.push(`${from.name} will be emptied.`);
  }

  return {
    amount,
    fromAfter,
    toAfter: to.balance + amount,
    clamped,
    warnings,
    blocked: false,
  };
}
