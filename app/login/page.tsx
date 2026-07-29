import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { AuthForm } from '@/components/auth-form';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; deleted?: string }>;
}) {
  if (await currentUser()) redirect('/');

  // `expired` is set when a session could not be refreshed mid-action
  // (lib/db/driver.ts); landing on a sign-in screen with no explanation reads
  // as data loss. `deleted` is the confirmation that a closure went through.
  const { expired, deleted } = await searchParams;

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

      <div className="mt-6">
        <Card>
          <AuthForm mode="sign-in" />
        </Card>
      </div>
    </div>
  );
}
