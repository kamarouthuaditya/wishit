import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { AuthForm } from '@/components/auth-form';
import { GoogleButton } from '@/components/google-button';
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
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-[15px] text-ink-soft">
        Your figures, and nobody else’s.
      </p>

      {expired && (
        <p className="mt-4 border border-warn/40 bg-warn-soft px-4 py-3 text-[13px] text-warn">
          You were signed out because the session expired. Nothing was lost —
          sign in and carry on.
        </p>
      )}

      {deleted && (
        <p className="mt-4 border border-line bg-surface px-4 py-3 text-[13px] text-ink-soft">
          Your account and everything in it have been deleted. Nothing is kept.
        </p>
      )}

      {error && (
        <p className="mt-4 border border-bad/40 px-4 py-3 text-[13px] text-bad">
          {error === 'cancelled'
            ? 'The Google sign-in was cancelled. Nothing happened.'
            : 'Google sign-in did not go through. Try again, or use your email and password.'}
        </p>
      )}

      <div className="mt-6">
        <Card>
          <GoogleButton next={next} />

          {/* A rule with a word in it: the two ways in are alternatives, not a
              sequence, and a bare gap makes the second look like a footnote. */}
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[11px] uppercase tracking-[0.08em] text-ink-faint">
              or
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <AuthForm mode="sign-in" />
        </Card>
      </div>
    </div>
  );
}
