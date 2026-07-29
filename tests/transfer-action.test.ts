import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoalRow } from '@/lib/db/types';

// Server-only module talking to a driver; both stubbed so the action's own
// wiring — field names, lookup, clamping, what it writes — can be tested.
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let goals: GoalRow[] = [];
const update = vi.fn();
vi.mock('@/lib/db/driver', () => ({
  driver: () => ({
    list: async () => goals,
    update,
  }),
}));

const { transferBetweenGoals } = await import('@/lib/actions');

function goal(id: string, extra: Partial<GoalRow> = {}): GoalRow {
  return {
    id,
    name: id,
    target: 1_00_000,
    current_amount: 0,
    deadline: null,
    status: 'active',
    contribute_until: null,
    stop_at_deadline: false,
    priority: 1,
    expected_return_pct: 0,
    is_protected: false,
    fixed_contribution: null,
    weight: 1,
    ...extra,
  };
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

describe('transferBetweenGoals', () => {
  beforeEach(() => {
    update.mockReset().mockImplementation(async (_t, id, patch) => ({ id, ...patch }));
    goals = [
      goal('ef', { name: 'Emergency Fund', current_amount: 90_000, is_protected: true }),
      goal('laptop', { name: 'Laptop', target: 80_000, current_amount: 0 }),
    ];
  });

  it('debits the source and credits the destination', async () => {
    await transferBetweenGoals(
      form({ from_id: 'ef', to_id: 'laptop', amount: '50000' }),
    );

    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith('goal', 'ef', { current_amount: 40_000 });
    expect(update).toHaveBeenCalledWith('goal', 'laptop', { current_amount: 50_000 });
  });

  it('applies the same caps the form previews', async () => {
    await transferBetweenGoals(
      form({ from_id: 'ef', to_id: 'laptop', amount: '500000' }),
    );

    // Capped at the 80,000 the laptop needs, not the 90,000 available.
    expect(update).toHaveBeenCalledWith('goal', 'ef', { current_amount: 10_000 });
    expect(update).toHaveBeenCalledWith('goal', 'laptop', { current_amount: 80_000 });
  });

  it('writes nothing for a missing goal, a zero amount, or a goal onto itself', async () => {
    await transferBetweenGoals(form({ from_id: 'ef', to_id: 'gone', amount: '1000' }));
    await transferBetweenGoals(form({ from_id: 'ef', to_id: 'laptop', amount: '0' }));
    await transferBetweenGoals(form({ from_id: 'ef', to_id: 'ef', amount: '1000' }));
    await transferBetweenGoals(form({ to_id: 'laptop', amount: '1000' }));

    expect(update).not.toHaveBeenCalled();
  });
});
