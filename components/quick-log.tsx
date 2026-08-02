'use client';

import { useState } from 'react';
import { LogForm } from '@/components/log-form';
import { IconPlus } from '@/components/icons';
import { Button } from '@/components/ui';
import { Dialog } from '@/components/dialog';

/**
 * The one action, always within reach.
 *
 * Logging a spend was a panel halfway down the dashboard, which meant the thing
 * you do daily lived where you had to go looking for it, while things you do
 * monthly sat above it. It is now a button in the header — the only lime block
 * in the chrome — and it opens over whatever page you are on, so a spend can be
 * logged from the loans page as easily as from the dashboard.
 *
 * Centred like every other create dialog, not anchored under the button: a
 * pinned popover reads as a small, secondary action, and logging a spend is
 * the one thing this app expects you to do every day.
 */
export function QuickLog({
  categories,
  cards,
  today,
}: {
  categories: string[];
  cards: { id: string; name: string }[];
  today: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="text-[14px]"
      >
        <IconPlus size={14} />
        Log a spend
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Log a spend">
        <LogForm
          categories={categories}
          defaultDate={today}
          cards={cards}
          listId="wishit-quick-categories"
          defaultExpanded
        />
      </Dialog>
    </>
  );
}
