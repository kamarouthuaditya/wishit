'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  resendCode,
  verifyEmail,
  verifyResetCode,
  type AuthState,
} from '@/lib/auth-actions';
import {
  DISPLAY_LENGTH,
  formatPartial,
  isComplete,
} from '@/lib/auth-code';
import { Button, Field, Input } from '@/components/ui';

/**
 * The code from the email. One field, wide and monospaced — this screen is the
 * last thing between somebody and the app, so it does one thing and gets out of
 * the way.
 *
 * The field re-groups as you type, so it always reads the way the email does,
 * and it fixes the four characters people get wrong on the way past: `O`
 * becomes `0`, `I` and `L` become `1`, lowercase becomes upper. Pasting the
 * whole `A1B2-C3D4-E5F6` works, and so does typing it without the dashes.
 */
export function VerifyForm({
  email,
  purpose = 'sign-up',
}: {
  email: string;
  purpose?: 'sign-up' | 'password-reset';
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    purpose === 'sign-up' ? verifyEmail : verifyResetCode,
    {},
  );
  const [resent, setResent] = useState<AuthState | null>(null);
  const [resending, startResend] = useTransition();
  const [code, setCode] = useState('');

  const message = state.error ?? resent?.error ?? resent?.notice;
  const isError = Boolean(state.error ?? resent?.error);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <Field label="Code" hint={`Sent to ${email}. It lasts one hour.`}>
          <Input
            name="token"
            value={code}
            onChange={(event) => setCode(formatPartial(event.target.value))}
            autoComplete="one-time-code"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={DISPLAY_LENGTH}
            autoFocus
            required
            placeholder="A1B2-C3D4-E5F6"
            className="text-center font-mono text-[19px] uppercase tracking-[0.18em] placeholder:tracking-[0.18em] placeholder:text-ink-faint"
            aria-invalid={Boolean(state.error) || undefined}
          />
        </Field>

        {message && (
          <p
            role={isError ? 'alert' : 'status'}
            className={
              isError
                ? 'rounded-lg border border-bad/30 bg-bad-soft px-4 py-3 text-[14px] text-bad'
                : 'rounded-lg border border-good/30 bg-good-soft px-4 py-3 text-[14px] text-good'
            }
          >
            {message}
          </p>
        )}

        <Button
          type="submit"
          disabled={pending || !isComplete(code)}
          className="w-full"
        >
          {pending
            ? 'Checking…'
            : purpose === 'sign-up'
              ? 'Verify and continue'
              : 'Continue to set a password'}
        </Button>
      </form>

      <p className="text-center text-[14px] text-ink-soft">
        Nothing arrived?{' '}
        <button
          type="button"
          disabled={resending}
          onClick={() =>
            startResend(async () => {
              const result = await resendCode();
              setResent(result);
              // The code in the field is the one from the email that has just
              // been superseded. Leaving it there invites a wrong-code error.
              if (!result.error) setCode('');
            })
          }
          className="text-accent disabled:text-ink-faint"
        >
          {resending ? 'Sending…' : 'Send another code'}
        </button>
        {' · '}
        Check spam before asking for a third.
      </p>
    </div>
  );
}
