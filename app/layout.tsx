import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Lora } from 'next/font/google';
import Link from 'next/link';
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
import { budgetsByCategory } from '@/lib/model/actuals';
import { isoDate } from '@/lib/format';
import { currentUser, isAuthConfigured } from '@/lib/supabase/server';
import { now } from '@/lib/clock';
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
    { media: '(prefers-color-scheme: light)', color: '#F3F2F2' },
    { media: '(prefers-color-scheme: dark)', color: '#161513' },
  ],
};

// The Classical pair, adopted whole rather than mapped onto the old brand:
// Lora carries every number and control; Cormorant Garamond is the one piece
// of warmth, and only ever at heading size.
const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-cormorant',
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

  /*
   * Both reads at once, and only one of each per request.
   *
   * These are the two independent things the chrome needs, and they used to run
   * in series: the snapshot, then — once it said setup was finished — a month of
   * transactions for the notices. Against a database about 450ms away that
   * second await was pure addition, because it could not start until the first
   * had landed. Run together they cost what the slower one costs.
   *
   * The transactions are fetched before anything has established they are
   * wanted, which during onboarding they are not. That is deliberate: latency
   * dominates so completely here that nine parallel reads (~490ms) cost barely
   * more than one (~450ms), so an extra request alongside them is free in the
   * only currency that matters, while making it conditional would put it back
   * in series for everybody who has finished setting up.
   *
   * `loadSnapshot` is memoised per request, which is what makes this affordable
   * at all: the welcome layout and the step inside it both ask for the same
   * snapshot, and all three callers now share this one read instead of racing
   * to make their own.
   */
  const [snapshot, transactions] = signedIn
    ? await Promise.all([
        loadSnapshot().catch(() => null),
        loadTransactionsForMonth(monthKeyOf()).catch(() => []),
      ])
    : [null, []];

  const inApp = snapshot?.profile.setup_complete === true;

  const categories = snapshot
    ? [...new Set(snapshot.expenses.map((e) => e.category))].sort()
    : [];

  // Notices are for the app proper. Mid-onboarding there is nothing to notice.
  const notices = inApp && snapshot ? buildNotices(snapshot, transactions) : [];

  const headerDate = now().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });

  /*
   * The keypad sheet's category chips and its "puts you further over budget"
   * line, both computed once here rather than inside the client component —
   * the transactions and the budget are already in this request, and the
   * sheet has no business reading the database itself.
   */
  const month = monthKeyOf();
  const monthName = new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', {
    month: 'long',
  });
  const recentCategories = [...new Set(transactions.map((t) => t.category))].slice(0, 4);
  const categoryBudgets: Record<string, { budget: number; logged: number }> = {};
  if (snapshot) {
    const budgets = budgetsByCategory(snapshot.expenses, month);
    const logged = new Map<string, number>();
    for (const t of transactions) {
      logged.set(t.category, (logged.get(t.category) ?? 0) + Number(t.amount));
    }
    for (const [category, line] of budgets) {
      categoryBudgets[category] = { budget: line.amount, logged: logged.get(category) ?? 0 };
    }
  }

  return (
    <html
      lang="en"
      className={`h-full ${lora.variable} ${cormorant.variable}`}
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
        {/*
          64px, hairline bottom — the build spec's exact header. Left: the
          wordmark and the section nav, 36px apart. Right: today's date, a
          1px×20px divider, the primary log action, and the avatar. `Want`
          and the bell are not in the spec's header at all, but cutting them
          was a feature loss the brief never asked for, so they ride along
          beside the log button instead of replacing anything it names.
        */}
        <header className="sticky top-0 z-20 border-b border-line bg-paper">
          <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-9 px-6 lg:px-9">
            <Link
              href={signedIn ? '/' : '/login'}
              className="font-display shrink-0 text-[23px] leading-none tracking-tight"
            >
              Wish<span className="text-accent">it</span>
            </Link>

            {inApp && <Nav />}

            <div className="ml-auto flex items-center gap-4">
              {inApp && (
                <>
                  <span className="tnum hidden whitespace-nowrap text-[13px] font-medium text-ink-soft md:flex lg:text-[14px] lg:font-semibold xl:text-[15px]">
                    {headerDate}
                  </span>
                  <span aria-hidden className="hidden h-5 w-px bg-line md:block" />
                </>
              )}

              {inApp && (
                <div className="flex items-center gap-3">
                  <QuickWish />
                  {/* The header's own trigger is a desktop control now — the
                      phone has the same action in the tab bar, and offering it
                      twice on a 390px screen is a button competing with itself. */}
                  <div className="hidden md:block">
                    <QuickLog
                      categories={categories}
                      cards={snapshot.cards}
                      today={isoDate()}
                    />
                  </div>
                  <Notifications notices={notices} />
                </div>
              )}
              {signedIn && (
                <Avatar
                  name={snapshot?.profile.name}
                  email={user?.email}
                />
              )}
            </div>
          </div>
        </header>

        {/* The footer below now carries the clearance for the phone bottom bar. */}
        <main className="mx-auto w-full max-w-[1440px] grow px-6 py-8 md:py-10 lg:px-9">
          {children}
        </main>

        {/*
          A quiet footer whose only job is the report link. It sits below the
          content rather than in the header because irritation arrives at the
          end of a page, not the top of one — and because the header on a phone
          has no room left.
        */}
        <footer className="mx-auto w-full max-w-[1440px] px-6 pb-24 pt-2 md:pb-8 lg:px-9">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-[13px] text-ink-faint">
            <span>Wishit — early access. Numbers may still be wrong; tell us when they are.</span>
            <FeedbackLink signedIn={signedIn} />
          </div>
        </footer>

        {inApp && (
          <MobileNav
            recentCategories={recentCategories}
            categoryBudgets={categoryBudgets}
            today={isoDate()}
            monthTitle={monthName}
          />
        )}

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
