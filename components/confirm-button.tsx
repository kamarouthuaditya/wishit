'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { IconTrash } from '@/components/icons';

/**
 * Delete, with a second beat.
 *
 * Nothing in this app used to confirm anything: one click removed a goal with
 * its balance, or a loan with its schedule. Rather than a modal — which stops
 * the world for a decision this small — the button turns into its own
 * confirmation in place, and reverts if you click anywhere else in the row.
 */
export function ConfirmButton({
  action,
  id,
  label = 'Delete',
  confirm,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label?: string;
  /** What is about to happen, in one sentence. */
  confirm: string;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button
        variant="danger"
        type="button"
        onClick={() => setArmed(true)}
        aria-label={confirm}
      >
        <IconTrash size={14} />
        {label}
      </Button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] text-warn" role="alert">
        {confirm}
      </span>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <Button variant="danger" type="submit" className="border-bad/50">
          Yes, delete
        </Button>
      </form>
      <Button variant="ghost" type="button" onClick={() => setArmed(false)}>
        Keep
      </Button>
    </span>
  );
}
