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
    <div role="radiogroup" aria-label="Theme" className="grid gap-4 sm:grid-cols-3">
      <Choice
        value="light"
        current={theme}
        onChoose={choose}
        icon={<IconSun size={14} />}
        label="Light"
        note="Daylight, one hand"
      />
      <Choice
        value="dark"
        current={theme}
        onChoose={choose}
        icon={<IconMoon size={14} />}
        label="Dark"
        note="Lime on near-black"
      />
      <Choice
        value="money"
        current={theme}
        onChoose={choose}
        icon={<IconNote size={14} />}
        label="Money"
        note="Banknote, printed"
      />
    </div>
  );
}

/**
 * One option, drawn as the thing it does.
 *
 * A swatch answers "what colour", which was never the question — the themes
 * differ in which end of the accent does the work, and a strip of three
 * rectangles cannot show that. So each option is a small window in its own
 * theme, and the `data-theme` on it is the same attribute the real page uses:
 * the preview is not a picture of the theme, it is the theme, applied to
 * something small.
 */
function Choice({
  value,
  current,
  onChoose,
  icon,
  label,
  note,
}: {
  value: Theme;
  current: Theme;
  onChoose: (t: Theme) => void;
  icon: React.ReactNode;
  label: string;
  note: string;
}) {
  const on = current === value;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={() => onChoose(value)}
      className={
        'group cursor-pointer border p-2 text-left transition-colors duration-[140ms] ' +
        /* The chosen card is marked by its edge and its square, not by a wash:
           `--accent-dim` is lime at 0.45 in light, and a card filled with it
           shouts louder than the preview it is supposed to be framing. */
        (on
          ? 'border-accent bg-surface-lift'
          : 'border-line hover:border-line-strong')
      }
    >
      <ThemeWindow theme={value} />

      <span className="mt-2.5 flex items-center gap-2 px-1 pb-0.5">
        {/* The mark for the chosen one is a filled square, not a tick: this
            product has no round controls and nothing else in it is ticked. */}
        <span
          aria-hidden
          className={
            'size-3 shrink-0 border transition-colors duration-[140ms] ' +
            (on ? 'border-accent bg-accent-fill' : 'border-line-strong')
          }
        />
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={on ? 'text-accent' : 'text-ink-faint'}>{icon}</span>
          <span
            className={
              'text-[13px] uppercase tracking-[0.07em] ' +
              (on ? 'font-bold text-ink' : 'font-medium text-ink-soft')
            }
          >
            {label}
          </span>
        </span>
      </span>
      <span className="mt-0.5 block px-1 pb-1 text-[12px] text-ink-faint">
        {note}
      </span>
    </button>
  );
}

/**
 * The app at thumbnail size: a heading, the one big figure the dashboard is
 * built around, a couple of rows, and the filled button. Enough structure that
 * the three previews differ the way the real screens differ — where the block
 * is, and what carries the thin strokes — and no more, because a legible
 * miniature of a real page is not a thing that exists at 150 pixels wide.
 */
function ThemeWindow({ theme }: { theme: Theme }) {
  return (
    <span
      data-theme={theme}
      /* Wide and short on a phone, where three of these stack and a 4:3 card
         turns the last step of the sequence into a scroll. */
      className="block aspect-[5/2] bg-paper p-1.5 sm:aspect-[4/3] sm:p-2"
    >
      <span className="flex h-full overflow-hidden rounded-lg border border-line bg-paper">
        {/* The nav rail. */}
        <span className="flex w-1/4 shrink-0 flex-col gap-1 border-r border-line bg-surface p-1.5">
          <span className="h-1 w-full bg-accent" />
          <span className="h-0.5 w-3/4 bg-line-strong" />
          <span className="h-0.5 w-5/6 bg-line-strong" />
          <span className="h-0.5 w-2/3 bg-line-strong" />
        </span>

        <span className="flex min-w-0 flex-1 flex-col p-1.5">
          <span className="flex items-center gap-1">
            <span className="h-1 w-1/3 bg-ink-faint" />
            <span className="ml-auto h-1 w-1/6 bg-line-strong" />
          </span>

          {/* The hero figure, which is the whole dashboard. In light and dark
              the accent is what draws it; in money that role is the pale ink
              and the green goes to the block below, which is the split the
              three themes exist to express. */}
          <span className="mt-1.5 block h-2 w-3/5 bg-accent" />

          <span className="mt-1.5 flex flex-col gap-1">
            <span className="h-0.5 w-full bg-line" />
            <span className="h-0.5 w-5/6 bg-line" />
          </span>

          <span className="mt-auto flex items-end gap-1">
            {/* The filled button, with its label riding on it. */}
            <span className="flex h-3 flex-1 items-center border border-accent-edge bg-accent-fill px-1">
              <span className="h-0.5 w-1/2 bg-on-accent" />
            </span>
            <span className="h-3 w-1/4 border border-line-strong" />
          </span>
        </span>
      </span>
    </span>
  );
}
