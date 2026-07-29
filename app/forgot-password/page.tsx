import { ForgotPasswordForm } from '@/components/password-forms';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1 text-[15px] text-ink-soft">
        We will email you a code. Enter it on the next screen and you
        can choose a new password.
      </p>
      <div className="mt-6">
        <Card>
          <ForgotPasswordForm />
        </Card>
      </div>
    </div>
  );
}
