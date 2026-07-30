import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser, isAuthConfigured } from '@/lib/supabase/server';
import { signOut } from '@/lib/auth-actions';
import { loadSnapshot } from '@/lib/db/repository';
import { nameFromUser } from '@/lib/user-name';
import { saveProfileName } from '@/lib/actions';
import { initials } from '@/components/avatar';
import { Button, Field, Input } from '@/components/ui';
import { ThemeToggle } from '@/components/theme-toggle';
import { IconDownload, IconSignOut } from '@/components/icons';
import { PageGuide } from '@/components/page-guide';
import { DeleteAccount } from '@/components/delete-account';

export const dynamic = 'force-dynamic';

const JOINED = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * The account: who you are, and the three things you can do about it — change
 * your name, change your password, take your data out.
 */
export default async function AccountPage() {
  const user = isAuthConfigured ? await currentUser() : null;
  if (isAuthConfigured && !user) redirect('/login');

  const snapshot = await loadSnapshot();

  // A Google account has a name too, under its own keys — see lib/user-name.ts.
  const known = nameFromUser(user) || snapshot.profile.name;
  const first = known.split(' ')[0] ?? '';
  const last = known.split(' ').slice(1).join(' ');
  const fullName = known || snapshot.profile.name;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="flex items-center gap-4">
        <span
          style={{ borderRadius: '9999px' }}
          className="inline-flex size-14 items-center justify-center border border-line-strong bg-forest text-[18px] font-bold uppercase text-ink"
          aria-hidden
        >
          {initials(fullName || user?.email || 'Account')}
        </span>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[28px] leading-none">
              {fullName || 'Your account'}
            </h1>
            <PageGuide guide="account" />
          </div>
          {user && <p className="mt-2 text-[14px] text-ink-soft">{user.email}</p>}
        </div>
      </header>

      <section className="border border-line bg-surface">
        <h2 className="eyebrow border-b border-line px-5 py-3">Your name</h2>
        <form action={saveProfileName} className="grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="First name">
            <Input name="first_name" defaultValue={first} placeholder="Aditya" />
          </Field>
          <Field label="Last name">
            <Input name="last_name" defaultValue={last} placeholder="Kamarouthu" />
          </Field>
          <div className="flex items-end pb-1">
            <Button type="submit">Save</Button>
          </div>
        </form>
      </section>

      <section className="border border-line bg-surface">
        <h2 className="eyebrow border-b border-line px-5 py-3">Account</h2>
        <dl className="divide-y divide-line">
          <Row label="Email" value={user?.email ?? 'Local mode — no account'} />
          <Row
            label="Signed up"
            value={user?.created_at ? JOINED.format(new Date(user.created_at)) : '—'}
          />
          <Row
            label="Password"
            value={
              <Link href="/forgot-password" className="text-accent">
                Send a reset code
              </Link>
            }
          />
        </dl>
      </section>

      <section className="border border-line bg-surface">
        <h2 className="eyebrow border-b border-line px-5 py-3">Appearance</h2>
        {/* Stacked rather than set beside the copy: the picker is three cards
            now, and squeezed into the right half of a row they are too small
            to be previews of anything. */}
        <div className="space-y-4 p-5">
          <p className="max-w-prose text-[13px] text-ink-soft">
            Light by default, for logging in daylight. Dark and money both suit
            the late session, money in black with note green on the buttons and
            the figures. Remembered on this device.
          </p>
          <ThemeToggle />
        </div>
      </section>

      <section className="border border-line bg-surface">
        <h2 className="eyebrow border-b border-line px-5 py-3">Your data</h2>
        <div className="space-y-4 p-5">
          <p className="text-[13px] text-ink-soft">
            Everything you log can leave with you. Spending as CSV for a
            spreadsheet; everything else — income, expenses, goals, loans,
            cards, wishlist and snapshots — as JSON, because flattening a model
            with effective dates and priorities into one table loses what makes
            it mean anything.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/spending/export"
              download
              className="inline-flex items-center gap-2 border border-line-strong px-4 py-2 text-[13px] font-medium uppercase tracking-[0.06em] text-ink transition-colors duration-[140ms] hover:border-accent hover:text-accent"
            >
              <IconDownload size={15} />
              Spending (CSV)
            </a>
            <a
              href="/account/export"
              download
              className="inline-flex items-center gap-2 border border-line-strong px-4 py-2 text-[13px] font-medium uppercase tracking-[0.06em] text-ink transition-colors duration-[140ms] hover:border-accent hover:text-accent"
            >
              <IconDownload size={15} />
              Everything (JSON)
            </a>
          </div>
        </div>
      </section>

      {user?.email && (
        <section className="border border-bad/30 bg-surface">
          <h2 className="eyebrow border-b border-bad/30 px-5 py-3 text-bad">
            Close your account
          </h2>
          <div className="space-y-4 p-5">
            <p className="max-w-prose text-[13px] text-ink-soft">
              Deleting removes the account and every row attached to it, at
              once and for good. Nothing is archived, and we cannot restore it
              afterwards.
            </p>
            <DeleteAccount email={user.email} />
          </div>
        </section>
      )}

      {user && (
        <form action={signOut}>
          <Button variant="ghost" type="submit">
            <IconSignOut size={15} />
            Sign out
          </Button>
        </form>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-4 px-5 py-3.5">
      <dt className="text-[13px] text-ink-faint">{label}</dt>
      <dd className="text-[14px]">{value}</dd>
    </div>
  );
}
