import Link from 'next/link';
import { pendingEmail } from '@/lib/auth-actions';
import { VerifyForm } from '@/components/verify-form';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function VerifyResetPage() {
  const email = await pendingEmail();

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Enter your code</h1>
      <p className="mt-1 max-w-prose text-[15px] text-ink-soft">
        {email
          ? 'If that address has an account, a code is on its way.'
          : 'This step follows asking for a reset.'}
      </p>
      <div className="mt-6">
        <Card>
          {email ? (
            <VerifyForm email={email} purpose="password-reset" />
          ) : (
            <p className="text-[15px] text-ink-soft">
              We do not have a reset in progress — codes expire after an hour.{' '}
              <Link href="/forgot-password" className="text-accent">
                Ask for a new one
              </Link>
              .
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
