'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { signIn, signUp, type AuthState } from '@/lib/auth-actions';
import { PasswordInput } from '@/components/password-input';
import { Button, Field, Input } from '@/components/ui';

/**
 * One form, two modes. `useActionState` keeps the server's answer next to the
 * fields it is about, so a rejected password does not cost you the email you
 * already typed.
 */
export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const signingUp = mode === 'sign-up';
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    signingUp ? signUp : signIn,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {signingUp && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name">
            <Input
              name="first_name"
              autoComplete="given-name"
              autoFocus
              required
              placeholder="Aditya"
              aria-invalid={state.field === 'name' || undefined}
            />
          </Field>
          <Field label="Last name" hint="Optional">
            <Input
              name="last_name"
              autoComplete="family-name"
              placeholder="Kamarouthu"
            />
          </Field>
        </div>
      )}

      <Field label="Email">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          autoFocus={!signingUp}
          required
          placeholder="you@example.com"
          aria-invalid={state.field === 'email' || undefined}
        />
      </Field>

      <Field
        label="Password"
        hint={signingUp ? 'At least 8 characters' : undefined}
        action={
          signingUp ? undefined : (
            <Link href="/forgot-password" className="text-[14px] text-accent">
              Forgot?
            </Link>
          )
        }
      >
        <PasswordInput
          name="password"
          autoComplete={signingUp ? 'new-password' : 'current-password'}
          invalid={state.field === 'password'}
        />
      </Field>

      {signingUp && (
        <Field label="Confirm password">
          <PasswordInput
            name="confirm"
            autoComplete="new-password"
            invalid={state.field === 'password'}
          />
        </Field>
      )}

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-bad/30 bg-bad-soft px-4 py-3 text-[15px] text-bad"
        >
          {state.error}
        </p>
      )}
      {state.notice && (
        <p
          role="status"
          className="rounded-lg border border-good/30 bg-good-soft px-4 py-3 text-[15px] text-good"
        >
          {state.notice}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'One moment…' : signingUp ? 'Create account' : 'Sign in'}
      </Button>

      <p className="text-center text-[15px] text-ink-soft">
        {signingUp ? (
          <>
            Already have an account?{' '}
            <Link href="/login" className="text-accent">
              Sign in
            </Link>
          </>
        ) : (
          <>
            No account yet?{' '}
            <Link href="/signup" className="text-accent">
              Create one
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
