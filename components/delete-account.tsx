'use client';

import { useActionState, useState } from 'react';
import { deleteAccount, type DeleteState } from '@/lib/account-actions';
import { Button, Field, Input } from '@/components/ui';

const EMPTY: DeleteState = {};

/**
 * The one action in the app with no undo, so it is two deliberate steps: reveal
 * the form, then type the address it belongs to. Armed in place rather than in
 * a modal, which is the pattern the rest of the app already uses for delete.
 */
export function DeleteAccount({ email }: { email: string }) {
  const [state, action, pending] = useActionState(deleteAccount, EMPTY);
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button variant="danger" type="button" onClick={() => setArmed(true)}>
        Delete this account
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <Field
        label="Type your email to confirm"
        hint="Every figure, goal, loan and logged spend goes with it. There is no copy on our side — export first if you want one."
      >
        <Input
          name="confirm_email"
          type="email"
          autoComplete="off"
          placeholder={email}
          required
          autoFocus
        />
      </Field>

      {state.error && (
        <p role="alert" className="text-[14px] text-bad">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="danger" type="submit" disabled={pending}>
          {pending ? 'Deleting…' : 'Delete permanently'}
        </Button>
        <Button variant="ghost" type="button" onClick={() => setArmed(false)}>
          Keep my account
        </Button>
      </div>
    </form>
  );
}
