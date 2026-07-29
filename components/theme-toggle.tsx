'use client';

import { useSyncExternalStore } from 'react';
import { IconMoon, IconNote, IconSun } from '@/components/icons';

export type Theme = 'light' | 'dark' | 'money';

/** Light is the absence of the attribute, so it is not in this list. */
const ATTR_THEMES = ['dark', 'money'] as const;

/** Read by the inline script in the layout, so both have to agree. */
export const THEME_KEY = 'wishit-theme';

/**
 * The theme lives on `<html>`, not in React state: the inline script in the
 * layout sets it before hydration, and a second copy of the truth is how two
 * views end up disagreeing. Reading it as an external store keeps the control
 * in step with the document however the document got that way.
 */
const CHANGED = 'wishit:themechange';

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  return () => window.removeEventListener(CHANGED, onChange);
}

function readTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  return ATTR_THEMES.includes(set as (typeof ATTR_THEMES)[number])
    ? (set as Theme)
    : 'light';
}

/* The server renders the shipped default; the client corrects it on hydration. */
const serverTheme = (): Theme => 'light';

/**
 * Light is the default, and it is the one the app ships with: the fifteen-second
 * use is a phone in daylight. Dark stays a deliberate choice for the late
 * session, and it is remembered per browser rather than read from the OS —
 * an OS preference set for a code editor is not a statement about this app.
 * Money is the same late session in banknote green on black; it changes how the
 * app looks and nothing about what it says.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);

  function choose(next: Theme) {
    if (next === 'light') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private mode, or storage denied. The choice still applies to this page.
    }
    window.dispatchEvent(new Event(CHANGED));
  }

  return (
    <div className="flex items-center gap-3">
      <div
        role="radiogroup"
        aria-label="Theme"
        className="inline-flex border border-line-strong"
      >
        <Choice
          value="light"
          current={theme}
          onChoose={choose}
          icon={<IconSun size={15} />}
          label="Light"
        />
        <Choice
          value="dark"
          current={theme}
          onChoose={choose}
          icon={<IconMoon size={15} />}
          label="Dark"
        />
        <Choice
          value="money"
          current={theme}
          onChoose={choose}
          icon={<IconNote size={15} />}
          label="Money"
        />
      </div>
    </div>
  );
}

function Choice({
  value,
  current,
  onChoose,
  icon,
  label,
}: {
  value: Theme;
  current: Theme;
  onChoose: (t: Theme) => void;
  icon: React.ReactNode;
  label: string;
}) {
  const on = current === value;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={() => onChoose(value)}
      className={
        /* Three segments have to clear a 320px phone, so the padding tightens. */
        'inline-flex cursor-pointer items-center gap-1.5 px-3 py-2 text-[12px] uppercase tracking-[0.07em] ' +
        'transition-colors duration-[140ms] not-last:border-r not-last:border-line-strong ' +
        (on
          ? 'bg-accent-fill font-bold text-on-accent'
          : 'font-medium text-ink-faint hover:text-ink')
      }
    >
      {icon}
      {label}
    </button>
  );
}
