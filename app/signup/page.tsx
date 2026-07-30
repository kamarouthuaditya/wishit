import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { AuthForm } from '@/components/auth-form';
import { GoogleButton } from '@/components/google-button';
import { WelcomeCatsArt } from '@/components/illustrations/welcomecats';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  if (await currentUser()) redirect('/');

  return (
    <div className="mx-auto max-w-md py-10">
      <WelcomeCatsArt className="mx-auto mb-7 hidden h-32 w-auto sm:block" />

      <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
      <p className="mt-1 max-w-prose text-[15px] text-ink-soft">
        Wishit answers one question: <em>if I buy this, how much longer do I wait
        for the things I actually want?</em> Setting it up takes about three
        minutes.
      </p>
      <div className="mt-6">
        <Card>
          {/* Google is the same button on both screens: with an OAuth provider
              there is no difference between signing up and signing in, and
              asking somebody to pick the right one of two identical doors is a
              question the app can answer itself. */}
          <GoogleButton />
          <AuthForm mode="sign-up" />
        </Card>
      </div>
    </div>
  );
}
