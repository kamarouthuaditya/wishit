import { describe, expect, it } from 'vitest';
import { planTransfer, type TransferParty } from '@/lib/model/transfer';

function party(extra: Partial<TransferParty> = {}): TransferParty {
  return {
    id: 'g',
    name: 'Goal',
    balance: 0,
    target: 1_00_000,
    isProtected: false,
    ...extra,
  };
}

const emergencyFund = () =>
  party({
    id: 'ef',
    name: 'Emergency Fund',
    balance: 90_000,
    target: 1_00_000,
    isProtected: true,
  });

const laptop = () => party({ id: 'laptop', name: 'Laptop', target: 80_000 });

describe('planTransfer', () => {
  it('moves saved money from one goal to the other', () => {
    const plan = planTransfer(emergencyFund(), laptop(), 50_000);

    expect(plan.amount).toBe(50_000);
    expect(plan.fromAfter).toBe(40_000);
    expect(plan.toAfter).toBe(50_000);
    expect(plan.blocked).toBe(false);
  });

  it('says so when a protected goal is the source', () => {
    const plan = planTransfer(emergencyFund(), laptop(), 10_000);
    expect(plan.warnings.join(' ')).toContain('protected');
  });

  it('flags dropping the source back under its target', () => {
    const source = party({ id: 'trip', name: 'Trip', balance: 60_000, target: 50_000 });
    const plan = planTransfer(source, laptop(), 20_000);
    expect(plan.warnings.join(' ')).toContain('back under its target');
  });

  it('never moves more than the source has', () => {
    const plan = planTransfer(emergencyFund(), laptop(), 5_00_000);

    expect(plan.amount).toBe(80_000); // capped by what the laptop needs first
    expect(plan.fromAfter).toBe(10_000);
    expect(plan.clamped).toBe('target-reached');
  });

  it('caps at what the destination still needs', () => {
    const nearlyThere = party({ id: 'laptop', name: 'Laptop', target: 80_000, balance: 75_000 });
    const plan = planTransfer(emergencyFund(), nearlyThere, 20_000);

    expect(plan.amount).toBe(5_000);
    expect(plan.toAfter).toBe(80_000);
    expect(plan.clamped).toBe('target-reached');
  });

  it('caps at the balance when the source is the smaller constraint', () => {
    const small = party({ id: 'trip', name: 'Trip', balance: 3_000, target: 20_000 });
    const plan = planTransfer(small, laptop(), 10_000);

    expect(plan.amount).toBe(3_000);
    expect(plan.fromAfter).toBe(0);
    expect(plan.clamped).toBe('insufficient');
    expect(plan.warnings.join(' ')).toContain('emptied');
  });

  it('blocks a transfer into a goal that is already funded', () => {
    const done = party({ id: 'done', name: 'Done', target: 50_000, balance: 50_000 });
    const plan = planTransfer(emergencyFund(), done, 5_000);

    expect(plan.blocked).toBe(true);
    expect(plan.amount).toBe(0);
    expect(plan.warnings.join(' ')).toContain('already reached its target');
  });

  it('blocks nonsense: no amount, an empty source, or a goal onto itself', () => {
    expect(planTransfer(emergencyFund(), laptop(), 0).blocked).toBe(true);
    expect(planTransfer(emergencyFund(), laptop(), -100).blocked).toBe(true);
    expect(planTransfer(emergencyFund(), laptop(), NaN).blocked).toBe(true);
    expect(planTransfer(party({ id: 'a', balance: 0 }), laptop(), 100).blocked).toBe(true);
    expect(planTransfer(emergencyFund(), emergencyFund(), 100).blocked).toBe(true);
  });

  it('leaves total savings untouched — only the earmark changes', () => {
    const from = emergencyFund();
    const to = laptop();
    const plan = planTransfer(from, to, 30_000);

    expect(plan.fromAfter + plan.toAfter).toBe(from.balance + to.balance);
  });
});
