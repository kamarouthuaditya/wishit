/**
 * A category name always lands on the same colour, everywhere it appears —
 * an expense's category dot, a wishlist item's chip, a spending-page legend.
 * The hash is a plain string sum rather than anything cryptographic: it only
 * has to be stable across renders and roughly spread eight names apart, not
 * resist collisions on purpose.
 */

export interface CategoryColor {
  /** Solid — the dot, the icon glyph, the ring. */
  fg: string;
  /** The wash behind it — a chip's background. */
  bg: string;
}

const PALETTE: CategoryColor[] = [
  { fg: 'text-cat-lime', bg: 'bg-cat-lime-soft' },
  { fg: 'text-cat-sky', bg: 'bg-cat-sky-soft' },
  { fg: 'text-cat-amber', bg: 'bg-cat-amber-soft' },
  { fg: 'text-cat-rose', bg: 'bg-cat-rose-soft' },
  { fg: 'text-cat-violet', bg: 'bg-cat-violet-soft' },
  { fg: 'text-cat-teal', bg: 'bg-cat-teal-soft' },
  { fg: 'text-cat-clay', bg: 'bg-cat-clay-soft' },
  { fg: 'text-cat-slate', bg: 'bg-cat-slate-soft' },
];

export function categoryColor(label: string): CategoryColor {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

/** Same hash, as a flat dot colour class for the solid background version. */
export function categoryDot(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length].fg.replace('text-', 'bg-');
}
