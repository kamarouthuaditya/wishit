import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { AuthForm } from '@/components/auth-form';
import { GoogleButton } from '@/components/google-button';
import { SignInArt } from '@/components/illustrations/signin';
import { AuthShell } from '@/components/auth-shell';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    expired?: string;
    deleted?: string;
    error?: string;
    next?: string;
  }>;
}) {
  if (await currentUser()) redirect('/');

  // `expired` is set when a session could not be refreshed mid-action
  // (lib/db/driver.ts); landing on a sign-in screen with no explanation reads
  // as data loss. `deleted` is the confirmation that a closure went through.
  const { expired, deleted, error, next } = await searchParams;

  return (
    <AuthShell
      art={<SignInArt className="h-40 w-auto" />}
      tagline="Your figures, and nobody else’s."
    >
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-[16px] text-ink-soft">
        Your figures, and nobody else’s.
      </p>

      {expired && (
        <p className="mt-4 rounded-xl bg-warn-soft px-4 py-3 text-[14px] text-warn">
          You were signed out because the session expired. Nothing was lost —
          sign in and carry on.
        </p>
      )}

      {deleted && (
        <p className="mt-4 text-[14px] text-ink-soft">
          Your account and everything in it have been deleted. Nothing is kept.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-xl bg-bad-soft px-4 py-3 text-[14px] text-bad">
          {error === 'cancelled'
            ? 'The Google sign-in was cancelled. Nothing happened.'
            : 'Google sign-in did not go through. Try again, or use your email and password.'}
        </p>
      )}

      <div className="mt-6">
        <Card>
          <GoogleButton next={next} />
          <AuthForm mode="sign-in" />
        </Card>
      </div>
    </AuthShell>
  );
}
