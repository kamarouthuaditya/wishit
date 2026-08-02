'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import {
  requestPasswordReset,
  updatePassword,
  type AuthState,
} from '@/lib/auth-actions';
import { PasswordInput } from '@/components/password-input';
import { Button, Field, Input } from '@/components/ui';

function Message({ state }: { state: AuthState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-bad/30 bg-bad-soft px-4 py-3 text-[15px] text-bad"
      >
        {state.error}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p
        role="status"
        className="rounded-lg border border-good/30 bg-good-soft px-4 py-3 text-[15px] text-good"
      >
        {state.notice}
      </p>
    );
  }
  return null;
}

/** "Email me a link." */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Email">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="you@example.com"
        />
      </Field>

      <Message state={state} />

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>

      <p className="text-center text-[15px] text-ink-soft">
        <Link href="/login" className="text-accent">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

/** "Here is my new password." Reached only through a live recovery link. */
export function NewPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    updatePassword,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <Field label="New password" hint="At least 8 characters">
        <PasswordInput
          name="password"
          autoComplete="new-password"
          autoFocus
          invalid={state.field === 'password'}
        />
      </Field>
      <Field label="Confirm password">
        <PasswordInput
          name="confirm"
          autoComplete="new-password"
          invalid={state.field === 'password'}
        />
      </Field>

      <Message state={state} />

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  );
}
