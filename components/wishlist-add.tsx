'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { Dialog } from '@/components/dialog';
import { WishlistItemForm } from '@/components/wishlist-item-form';
import { IconPlus } from '@/components/icons';

/**
 * Adding a wishlist item in full, from the same slot the other pages use.
 *
 * The full form used to live at the bottom of the page under its own heading,
 * which put a blank twelve-field form permanently below the list you came to
 * read — and left the page's own action wherever the list happened to end. It
 * opens in a dialog now, like a goal.
 */
export function WishlistAdd() {
  const [open, setOpen] = useState(false);

  return (
    <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 -mx-5 border-t border-line bg-paper px-5 py-3 md:bottom-0">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-2">
        <Button type="button" onClick={() => setOpen(true)}>
          <IconPlus size={15} />
          Add something
        </Button>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add something"
        hint="Nothing here touches your projections until the status is committed, so you can model freely."
      >
        <WishlistItemForm onSaved={() => setOpen(false)} />
      </Dialog>
    </div>
  );
}
