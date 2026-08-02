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
 *
 * Every caller renders this inside the row's edit form, so the confirmation is
 * a `formAction` on a submit button rather than a form of its own. It used to
 * be its own `<form>`, which nested one form inside another: the browser sent
 * the submit to the outer form, whose action is React's "unexpectedly
 * submitted" placeholder, and the delete never ran. Nothing on screen said so
 * — the row simply stayed.
 *
 * `formNoValidate` because the enclosing form is an edit form full of required
 * fields, and an empty amount is no reason to refuse to delete the row.
 */
export function ConfirmButton({
  action,
  id,
  label = 'Delete',
  confirm,
  size = 'sm',
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label?: string;
  /** What is about to happen, in one sentence. */
  confirm: string;
  /** Row actions are `sm`; this only ever sits on a row. */
  size?: 'sm' | 'md';
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button
        variant="danger"
        size={size}
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
      <span className="text-[13px] text-warn" role="alert">
        {confirm}
      </span>
      {/*
        Named `id` like the enclosing form's own hidden field and carrying the
        same value, so the action gets a row id either way round.
      */}
      <input type="hidden" name="id" value={id} />
      <Button
        variant="danger"
        size={size}
        type="submit"
        formAction={action}
        formNoValidate
        className="border-bad/50"
      >
        Yes, delete
      </Button>
      <Button
        variant="ghost"
        size={size}
        type="button"
        onClick={() => setArmed(false)}
      >
        Keep
      </Button>
    </span>
  );
}
