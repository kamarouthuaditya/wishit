'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconCard,
  IconClose,
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

/**
 * Three sections, by what you are doing rather than what the page is called:
 * setting the plan up, recording what happened, deciding on a purchase.
 *
 * Each opens on hover with a short delay, and closes on a longer one — a menu
 * that vanishes the instant the pointer leaves is unusable when the pointer has
 * to cross a gap to reach it. Hover alone is never the only way in: the trigger
 * is a button, so click and keyboard both work, which is also what makes this
 * usable on a touchscreen where hover does not exist.
 */

interface Item {
  href: string;
  label: string;
  Icon: (props: IconProps) => React.ReactElement;
  hint: string;
}

const DASHBOARD: Item = {
  href: '/',
  label: 'Dashboard',
  Icon: IconDashboard,
  hint: 'Where everything stands',
};

const SECTIONS: { name: string; items: Item[] }[] = [
  {
    name: 'Plan',
    items: [
      { href: '/expenses', label: 'Expenses', Icon: IconExpenses, hint: 'What the month costs' },
      { href: '/goals', label: 'Goals', Icon: IconGoal, hint: 'What you are building up' },
      { href: '/loans', label: 'Loans', Icon: IconLoan, hint: 'EMIs and what they really cost' },
      { href: '/cards', label: 'Cards', Icon: IconCard, hint: 'Bills and when they fall due' },
    ],
  },
  {
    name: 'Track',
    items: [
      { href: '/spending', label: 'Spending', Icon: IconSpending, hint: 'Every rupee that left' },
      { href: '/review', label: 'Review', Icon: IconReview, hint: 'Budget against what happened' },
    ],
  },
  {
    name: 'Decide',
    items: [
      { href: '/wishlist', label: 'Wishlist', Icon: IconWishlist, hint: 'What a purchase costs in time' },
      { href: '/setup', label: 'Settings', Icon: IconSettings, hint: 'Income, balances, modelling' },
    ],
  },
];

const ALL = SECTIONS.flatMap((section) => section.items);

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
      <NavLink item={DASHBOARD} current={isCurrent(DASHBOARD.href)} />

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
              className={`group relative inline-flex cursor-pointer items-center gap-1.5 py-1 text-[13px] transition-colors duration-[140ms] ${
                inside || isOpen ? 'text-ink' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {section.name}
              <span
                aria-hidden
                className={`text-[9px] transition-transform duration-[140ms] ${isOpen ? 'rotate-180' : ''}`}
              >
                ▼
              </span>
              <span
                aria-hidden
                className={`absolute inset-x-0 -bottom-0.5 h-px origin-left bg-accent transition-transform duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  inside ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                }`}
              />
            </button>

            {isOpen && (
              <div
                role="menu"
                aria-label={section.name}
                /* The panel starts flush under the trigger so the pointer never
                   crosses dead space on its way in. */
                className="rise absolute left-0 top-full z-50 w-72 border border-line-strong bg-surface pt-0 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)]"
              >
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setOpen(null)}
                    aria-current={isCurrent(item.href) ? 'page' : undefined}
                    className="flex items-start gap-3 border-b border-line px-4 py-3 transition-colors duration-[140ms] last:border-0 hover:bg-surface-lift"
                  >
                    <item.Icon
                      size={16}
                      className={`mt-0.5 ${isCurrent(item.href) ? 'text-accent' : 'text-ink-faint'}`}
                    />
                    <span>
                      <span
                        className={`block text-[14px] ${isCurrent(item.href) ? 'text-accent' : 'text-ink'}`}
                      >
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-ink-faint">
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
    </nav>
  );
}

function NavLink({ item, current }: { item: Item; current: boolean }) {
  const { Icon } = item;
  return (
    <Link
      href={item.href}
      aria-current={current ? 'page' : undefined}
      className={`group relative inline-flex items-center gap-1.5 py-1 text-[13px] transition-colors duration-[140ms] ${
        current ? 'text-ink' : 'text-ink-soft hover:text-ink'
      }`}
    >
      <Icon size={15} className={current ? 'text-accent' : 'text-ink-faint'} />
      {item.label}
      <span
        aria-hidden
        className={`absolute inset-x-0 -bottom-0.5 h-px origin-left bg-accent transition-transform duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          current ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
        }`}
      />
    </Link>
  );
}

/**
 * Phone: four destinations in thumb reach, everything else in a sheet grouped
 * the same way as the desktop menus, so the two do not teach different maps.
 */
export function MobileNav() {
  const isCurrent = useCurrent();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  const PRIMARY = [
    DASHBOARD,
    ALL.find((i) => i.href === '/spending')!,
    ALL.find((i) => i.href === '/goals')!,
    ALL.find((i) => i.href === '/wishlist')!,
  ];
  const inSheet = ALL.filter((item) => !PRIMARY.includes(item)).some((item) =>
    isCurrent(item.href),
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div ref={wrapper}>
      {open && (
        <div
          className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 max-h-[70vh] overflow-y-auto border-t border-line bg-surface md:hidden"
          role="menu"
          aria-label="All sections"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="eyebrow">Everything</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer p-1 text-ink-soft"
              aria-label="Close"
            >
              <IconClose size={18} />
            </button>
          </div>

          {SECTIONS.map((section) => (
            <div key={section.name}>
              <p className="eyebrow border-b border-line bg-paper px-4 py-2 text-[10px]">
                {section.name}
              </p>
              <ul>
                {section.items.map((item) => (
                  <li key={item.href} className="border-b border-line last:border-0">
                    <Link
                      href={item.href}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      aria-current={isCurrent(item.href) ? 'page' : undefined}
                      className={`flex items-center gap-3 px-4 py-3.5 text-[14px] ${
                        isCurrent(item.href) ? 'text-accent' : 'text-ink'
                      }`}
                    >
                      <item.Icon size={18} className="text-ink-faint" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-5">
          {PRIMARY.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isCurrent(item.href) ? 'page' : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-[0.06em] transition-colors duration-[140ms] ${
                  isCurrent(item.href) ? 'text-accent' : 'text-ink-faint'
                }`}
              >
                <item.Icon size={19} />
                {item.label === 'Dashboard' ? 'Home' : item.label}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setOpen((shown) => !shown)}
              aria-expanded={open}
              className={`flex h-14 w-full cursor-pointer flex-col items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-[0.06em] transition-colors duration-[140ms] ${
                open || inSheet ? 'text-accent' : 'text-ink-faint'
              }`}
            >
              <span aria-hidden className="flex h-[19px] items-center gap-[3px]">
                <span className="size-[3px] bg-current" />
                <span className="size-[3px] bg-current" />
                <span className="size-[3px] bg-current" />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
