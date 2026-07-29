'use client';

import { useRef, type ButtonHTMLAttributes, type MouseEvent } from 'react';

/**
 * Buttons press rather than lift: 985 scale for 90ms, no shadow, nothing cast.
 * Depth still comes from the ground and the hairline.
 *
 * Primary is the only large block of accent in the product, which is why it
 * reads as the thing to do, and it is the only one that takes the fill below.
 * Ghost and danger are outlines — there is no block to slide a plate across,
 * and a fill inside a hairline box reads as a bug.
 *
 * This module is a client component only because the fill needs to know where
 * the pointer was. Everything else in `ui.tsx` stays on the server, which is
 * why `Button` lives here and is re-exported from there rather than the other
 * way round.
 */

const FULL = 'inset(0)';

/** Collapsed against one edge, so the plate grows out *from* that edge. */
const EDGE = {
  top: 'inset(0 0 100% 0)',
  bottom: 'inset(100% 0 0 0)',
  left: 'inset(0 100% 0 0)',
  right: 'inset(0 0 0 100%)',
} as const;

type Edge = keyof typeof EDGE;

/** Which side of the box the pointer was nearest when it crossed. */
function nearestEdge(event: MouseEvent, el: HTMLElement): Edge {
  const box = el.getBoundingClientRect();
  const x = (event.clientX - box.left) / box.width;
  const y = (event.clientY - box.top) / box.height;
  const distance: Record<Edge, number> = {
    top: y,
    bottom: 1 - y,
    left: x,
    right: 1 - x,
  };
  return (Object.keys(distance) as Edge[]).reduce((a, b) =>
    distance[a] < distance[b] ? a : b,
  );
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
}) {
  const plate = useRef<HTMLSpanElement>(null);

  /*
   * Clip-path rather than a transform, deliberately. The plate animates in
   * place with no compositor layer of its own, so it cannot drift a subpixel
   * off the square corners and leave a seam along the edge it came from.
   */
  const moveTo = (event: MouseEvent, clip: string, instant = false) => {
    const el = plate.current;
    if (!el) return;
    if (instant) {
      // Snap to the entry edge unseen, then let the next change animate.
      el.style.transition = 'none';
      el.style.clipPath = EDGE[nearestEdge(event, event.currentTarget as HTMLElement)];
      void el.offsetWidth; // force reflow, or both writes coalesce into one frame
      el.style.transition = '';
    }
    el.style.clipPath = clip;
  };

  const isPrimary = variant === 'primary';

  // The label on a lime block is always the dark `on-accent` ink at weight 700,
  // never the page ground, or the control turns into a wash the moment the app
  // is on paper.
  const map = {
    primary:
      'group relative overflow-hidden border border-accent-edge bg-accent-fill text-on-accent font-bold active:scale-[0.985]',
    ghost:
      'border border-line-strong text-ink font-medium hover:border-accent hover:text-accent active:scale-[0.985]',
    danger:
      'border border-transparent text-bad font-medium hover:border-bad/50 active:scale-[0.985]',
  } as const;

  return (
    <button
      {...rest}
      onMouseEnter={isPrimary ? (e) => moveTo(e, FULL, true) : undefined}
      onMouseLeave={
        isPrimary
          ? (e) => moveTo(e, EDGE[nearestEdge(e, e.currentTarget as HTMLElement)])
          : undefined
      }
      className={
        'inline-flex cursor-pointer items-center justify-center gap-2 px-4 py-2 text-[13px] ' +
        'font-medium uppercase tracking-[0.06em] transition-all duration-[140ms] ' +
        'disabled:cursor-not-allowed disabled:opacity-50 ' +
        `${map[variant]} ${className}`
      }
    >
      {isPrimary && (
        <span
          ref={plate}
          aria-hidden
          style={{ clipPath: EDGE.bottom }}
          className="absolute inset-0 bg-accent-press transition-[clip-path] duration-[var(--t-fill)] ease-[var(--ease)]"
        />
      )}
      {/*
        The label sits above the plate and inverts as it arrives. Colour is a
        plain transition rather than part of the clip, so it crosses while the
        plate is still travelling instead of snapping when it lands.
      */}
      <span
        className={
          isPrimary
            ? 'relative z-10 inline-flex items-center gap-2 transition-colors duration-[var(--t-fill)] ease-[var(--ease)] group-hover:text-on-accent-press'
            : 'inline-flex items-center gap-2'
        }
      >
        {children}
      </span>
    </button>
  );
}
