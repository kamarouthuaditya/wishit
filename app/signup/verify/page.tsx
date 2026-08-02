import Link from 'next/link';
import { redirect } from 'next/navigation';
import { pendingEmail } from '@/lib/auth-actions';
import { currentUser } from '@/lib/supabase/server';
import { VerifyForm } from '@/components/verify-form';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function VerifyPage() {
  if (await currentUser()) redirect('/');

  const email = await pendingEmail();

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
      <p className="mt-1 max-w-prose text-[16px] text-ink-soft">
        {email
          ? 'We sent a code. Enter it here and your account is ready.'
          : 'This step follows signing up.'}
      </p>
      <div className="mt-6">
        <Card>
          {email ? (
            <VerifyForm email={email} />
          ) : (
            <p className="text-[16px] text-ink-soft">
              We do not have a sign-up in progress — codes expire after an hour.{' '}
              <Link href="/signup" className="text-accent">
                Start again
              </Link>
              .
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
