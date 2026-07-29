import type { Metadata, Viewport } from 'next';
import { Montserrat, Playfair_Display } from 'next/font/google';
import Link from 'next/link';
import { BalanceStrip } from '@/components/balance-strip';
import { MobileNav, Nav } from '@/components/nav';
import { Avatar } from '@/components/avatar';
import { Notifications } from '@/components/notifications';
import { QuickLog } from '@/components/quick-log';
import { QuickWish } from '@/components/quick-wish';
import { FeedbackLink } from '@/components/feedback';
import { Analytics } from '@vercel/analytics/next';
import { loadSnapshot, loadTransactionsForMonth } from '@/lib/db/repository';
import { buildNotices } from '@/lib/model/notifications';
import { monthKeyOf } from '@/lib/snapshot';
import { isoDate } from '@/lib/format';
import { currentUser, isAuthConfigured } from '@/lib/supabase/server';
import './globals.css';

// The header reads live figures, so nothing here can be prerendered.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Wishit',
  description: 'If I buy this, what does it cost me in time?',
  // Testers open this from a phone, and several will add it to a home screen.
  appleWebApp: { capable: true, title: 'Wishit', statusBarStyle: 'default' },
};

/**
 * The browser chrome takes its colour from here, so the address bar matches the
 * page ground rather than sitting as a grey band above it. Two values, because
 * the app ships a light and a dark ground and the phone picks by system theme.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F9FDF5' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0B0B' },
  ],
};

// Montserrat carries every number and control; Playfair is the one piece of
// warmth, and only ever at heading size.
const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // On the local JSON store there is no auth at all, so the app behaves as it
  // always did: one person, no sign-in.
  const user = isAuthConfigured ? await currentUser() : null;
  const signedIn = !isAuthConfigured || user != null;
  // Onboarding gets a bare shell. Every nav link during setup leads to a page
  // that redirects straight back to it, which is not navigation — it is a
  // corridor of locked doors.

  // One read for the whole chrome: the balance strip and the quick-log button
  // both need it, and two loads for one header would be silly.
  const snapshot = signedIn ? await loadSnapshot().catch(() => null) : null;
  const categories = snapshot
    ? [...new Set(snapshot.expenses.map((e) => e.category))].sort()
    : [];
  const inApp = signedIn && snapshot?.profile.setup_complete === true;

  // Notices are derived from the same read, plus this month's log.
  const notices =
    snapshot?.profile.setup_complete
      ? buildNotices(
          snapshot,
          await loadTransactionsForMonth(monthKeyOf()).catch(() => []),
        )
      : [];

  return (
    <html
      lang="en"
      className={`h-full ${montserrat.variable} ${playfair.variable}`}
      // The theme script writes to this element before React hydrates.
      suppressHydrationWarning
    >
      <head>
        {/*
          Runs before first paint, so a dark-theme user never sees a white
          flash. Light needs no attribute: it is the default in the stylesheet,
          so the failure mode of this script — blocked storage, a thrown
          exception, a stored value from a build that knew other names — is the
          theme the app ships with.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('wishit-theme');if(t==='dark'||t==='money')document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-paper">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3">
            <Link
              href={signedIn ? '/' : '/login'}
              className="font-display text-[22px] font-semibold leading-none tracking-tight"
            >
              Wish<span className="text-accent">it</span>
            </Link>

            {inApp && <Nav />}

            <div className="ml-auto flex items-center gap-3 text-[12px]">
              {inApp && (
                <>
                  <QuickWish />
                  <QuickLog
                    categories={categories}
                    cards={snapshot.cards}
                    today={isoDate()}
                  />
                  <Notifications notices={notices} />
                </>
              )}
              {signedIn && (
                <Avatar
                  name={snapshot?.profile.name}
                  email={user?.email}
                />
              )}
            </div>
          </div>
          {inApp && <BalanceStrip snapshot={snapshot} />}
        </header>

        {/* The footer below now carries the clearance for the phone bottom bar. */}
        <main className="mx-auto w-full max-w-6xl grow px-5 py-8 md:py-10">
          {children}
        </main>

        {/*
          A quiet footer whose only job is the report link. It sits below the
          content rather than in the header because irritation arrives at the
          end of a page, not the top of one — and because the header on a phone
          has no room left.
        */}
        <footer className="mx-auto w-full max-w-6xl px-5 pb-24 pt-2 md:pb-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-[12px] text-ink-faint">
            <span>Wishit — early access. Numbers may still be wrong; tell us when they are.</span>
            <FeedbackLink signedIn={signedIn} />
          </div>
        </footer>

        {inApp && <MobileNav />}

        {/*
          Page views only, no cookie and no identifier — which is the reason it
          is acceptable in an app where every page is somebody's salary. It
          reports which screens testers actually reach, and nothing about what
          is on them.
        */}
        <Analytics />
      </body>
    </html>
  );
}
