'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { Dialog } from '@/components/dialog';
import { WishlistItemForm } from '@/components/wishlist-item-form';
import { IconWishlist } from '@/components/icons';

/**
 * "I want that" — one tap from the header, into the same full form the
 * wishlist's own "Add something" button opens. It used to be a two-field
 * capture in an anchored popover — name and price, everything else left for
 * later — but that left every item half-specified until it was opened and
 * edited again. Centred like every other create dialog in the app, rather
 * than pinned under the button, so it reads as the same action wherever it
 * is triggered from.
 */
export function QuickWish() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <IconWishlist size={14} />
        <span className="hidden sm:inline">Want</span>
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Something you want"
        hint="Nothing here touches your projections until the status is committed, so you can model freely."
      >
        <WishlistItemForm onSaved={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
