import Link from 'next/link';
import { currentUser } from '@/lib/supabase/server';
import { NewPasswordForm } from '@/components/password-forms';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function NewPasswordPage() {
  const user = await currentUser();

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      {user ? (
        <>
          <p className="mt-1 text-[15px] text-ink-soft">
            Setting the password for {user.email}.
          </p>
          <div className="mt-6">
            <Card>
              <NewPasswordForm />
            </Card>
          </div>
        </>
      ) : (
        <div className="mt-6">
          <Card>
            <p className="text-[15px] text-ink-soft">
              This page opens from a reset link, and that one seems to have
              expired — they last an hour.{' '}
              <Link href="/forgot-password" className="text-accent">
                Send yourself a new one
              </Link>
              .
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
