'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconCard,
  IconDashboard,
  IconExpenses,
  IconGoal,
  IconLoan,
  IconReview,
  IconSettings,
  IconSpending,
  IconWishlist,
  type IconProps,
} from '@/components/icons';
import { MobileLogSheet } from '@/components/mobile-log-sheet';

/**
 * Two sections plus two direct links, by what you are doing rather than what
 * the page is called: setting the plan up, recording what happened, deciding
 * on a purchase. `Decide` is a direct link rather than a dropdown now that it
 * is one destination — the rail-and-detail purchase view — not two.
 *
 * Each dropdown opens on hover with a short delay, and closes on a longer one
 * — a menu that vanishes the instant the pointer leaves is unusable when the
 * pointer has to cross a gap to reach it. Hover alone is never the only way
 * in: the trigger is a button, so click and keyboard both work, which is also
 * what makes this usable on a touchscreen where hover does not exist.
 */

interface Item {
  href: string;
  label: string;
  Icon: (props: IconProps) => React.ReactElement;
  hint: string;
}

const OVERVIEW: Item = {
  href: '/',
  label: 'Overview',
  Icon: IconDashboard,
  hint: 'Where everything stands',
};

const DECIDE: Item = {
  href: '/wishlist',
  label: 'Decide',
  Icon: IconWishlist,
  hint: 'What a purchase costs in time',
};

const SECTIONS: { name: string; Icon: (props: IconProps) => React.ReactElement; items: Item[] }[] = [
  {
    name: 'Plan',
    Icon: IconExpenses,
    items: [
      { href: '/expenses', label: 'Expenses', Icon: IconExpenses, hint: 'What the month costs' },
      { href: '/goals', label: 'Goals', Icon: IconGoal, hint: 'What you are building up' },
      { href: '/loans', label: 'Loans', Icon: IconLoan, hint: 'EMIs and what they really cost' },
      { href: '/cards', label: 'Cards', Icon: IconCard, hint: 'Bills and when they fall due' },
      { href: '/setup', label: 'Settings', Icon: IconSettings, hint: 'Income, balances, modelling' },
    ],
  },
  {
    name: 'Track',
    Icon: IconSpending,
    items: [
      { href: '/spending', label: 'Spending', Icon: IconSpending, hint: 'Every rupee that left' },
      { href: '/review', label: 'Review', Icon: IconReview, hint: 'Budget against what happened' },
    ],
  },
];

const ALL = [...SECTIONS.flatMap((section) => section.items), DECIDE];

function useCurrent() {
  const pathname = usePathname();
  return (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function Nav() {
  const isCurrent = useCurrent();
  const [open, setOpen] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nav = useRef<HTMLElement>(null);

  // Escape and outside clicks close whatever is open, as with any menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    const onClick = (e: MouseEvent) => {
      if (!nav.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const openNow = (name: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(name);
  };

  // The delay is the gap between trigger and panel: leave it too short and the
  // menu closes while the pointer is still travelling to it.
  const closeSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(null), 180);
  };

  return (
    <nav
      ref={nav}
      aria-label="Sections"
      className="hidden items-center gap-x-6 md:flex"
    >
      <NavLink item={OVERVIEW} current={isCurrent(OVERVIEW.href)} />

      {SECTIONS.map((section) => {
        const inside = section.items.some((item) => isCurrent(item.href));
        const isOpen = open === section.name;

        return (
          <div
            key={section.name}
            className="relative"
            onMouseEnter={() => openNow(section.name)}
            onMouseLeave={closeSoon}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : section.name)}
              onFocus={() => openNow(section.name)}
              aria-expanded={isOpen}
              aria-haspopup="menu"
              className={`group relative inline-flex cursor-pointer items-center gap-[7px] py-1 text-[15px] transition-colors duration-[140ms] ${
                inside || isOpen ? 'text-ink' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {inside && <section.Icon size={15} className="text-accent" />}
              {section.name}
              <span
                aria-hidden
                className={`text-[9px] transition-transform duration-[140ms] ${isOpen ? 'rotate-180' : ''}`}
              >
                ▼
              </span>
              <span
                aria-hidden
                className={`absolute inset-x-0 bottom-[-3px] h-px origin-left bg-accent transition-transform duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  inside ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                }`}
              />
            </button>

            {isOpen && (
              <div
                role="menu"
                aria-label={section.name}
                /* The panel starts with a little air under the trigger — a
                   rounded shape flush against it reads as clipped. */
                className="rise absolute left-0 top-[calc(100%+10px)] z-50 w-72 border border-line-strong bg-surface pt-0"
              >
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setOpen(null)}
                    aria-current={isCurrent(item.href) ? 'page' : undefined}
                    className="flex items-start gap-3 border-b border-line/70 px-4 py-3 transition-colors duration-[140ms] last:border-0 hover:bg-surface-lift"
                  >
                    <span
                      className={`mt-0.5 flex size-7 shrink-0 items-center justify-center ${
                        isCurrent(item.href) ? 'bg-accent-soft text-accent' : 'bg-surface-lift text-ink-faint'
                      }`}
                    >
                      <item.Icon size={15} />
                    </span>
                    <span>
                      <span
                        className={`block text-[15px] ${isCurrent(item.href) ? 'text-accent' : 'text-ink'}`}
                      >
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-ink-faint">
                        {item.hint}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <NavLink item={DECIDE} current={isCurrent(DECIDE.href)} />
    </nav>
  );
}

function NavLink({ item, current }: { item: Item; current: boolean }) {
  const { Icon } = item;
  return (
    <Link
      href={item.href}
      aria-current={current ? 'page' : undefined}
      className={`group relative inline-flex items-center gap-[7px] py-1 text-[15px] transition-colors duration-[140ms] ${
        current ? 'text-ink' : 'text-ink-soft hover:text-ink'
      }`}
    >
      {current && <Icon size={15} className="text-accent" />}
      {item.label}
      <span
        aria-hidden
        className={`absolute inset-x-0 bottom-[-3px] h-px origin-left bg-accent transition-transform duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          current ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
        }`}
      />
    </Link>
  );
}

/**
 * Phone: four destinations in thumb reach, plus a fifth slot that is not a
 * destination at all — the log button, centred on the bar's top edge. The old
 * `More` sheet held Expenses, Loans, Cards and Settings; those move to footer
 * links on Overview and inside Goals instead, because a phone-sized product
 * with two navigation maps (four tabs, plus a sheet with its own grouping) is
 * harder to hold in your head than one map with a couple of pages one tap
 * further away.
 */
export function MobileNav({
  recentCategories,
  categoryBudgets,
  today,
  monthTitle,
}: {
  recentCategories: string[];
  categoryBudgets: Record<string, { budget: number; logged: number }>;
  today: string;
  monthTitle: string;
}) {
  const isCurrent = useCurrent();

  const LEFT = [OVERVIEW, ALL.find((i) => i.href === '/spending')!];
  const RIGHT = [ALL.find((i) => i.href === '/goals')!, DECIDE];

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {LEFT.map((item) => (
          <MobileTab key={item.href} item={item} current={isCurrent(item.href)} />
        ))}

        <li className="flex justify-center">
          <MobileLogSheet
            recentCategories={recentCategories}
            categoryBudgets={categoryBudgets}
            today={today}
            monthTitle={monthTitle}
          />
        </li>

        {RIGHT.map((item) => (
          <MobileTab key={item.href} item={item} current={isCurrent(item.href)} />
        ))}
      </ul>
    </nav>
  );
}

function MobileTab({ item, current }: { item: Item; current: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        aria-current={current ? 'page' : undefined}
        className={`flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium uppercase tracking-[0.06em] transition-colors duration-[140ms] ${
          current ? 'text-accent' : 'text-ink-faint'
        }`}
      >
        <item.Icon size={19} />
        {item.label === 'Overview' ? 'Home' : item.label === 'Spending' ? 'Spend' : item.label}
      </Link>
    </li>
  );
}
