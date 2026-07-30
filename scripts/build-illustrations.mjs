/**
 * Turns the unDraw SVGs in `assets/illustrations` into React components that
 * take their colours from the theme.
 *
 * Why generate rather than ship the files and point an `<img>` at them: the
 * product has three grounds, and an account may override the brand pair at
 * runtime, so a flat asset would be right in exactly one of them. Inlined, the
 * fills are `var(--...)` and the art follows the page — no second copy for
 * dark, no third for money, no swap when somebody picks their own accent.
 *
 * Run after adding or replacing anything in `assets/illustrations`:
 *
 *     node scripts/build-illustrations.mjs
 *
 * Output is committed. Editing it by hand is fine right up until somebody runs
 * this again, so do not.
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';

const SOURCE = 'assets/illustrations';
const OUT = 'components/illustrations';

/**
 * unDraw's palette, mapped onto ours by the role each colour plays rather than
 * by how close the two are — the point is a picture that belongs to the page,
 * not a recoloured stock illustration.
 *
 * The ladder is the one the rest of the product uses: paper, panel, panel
 * above it, then the two hairline weights for the masses that need to read as
 * objects. Ink goes to whatever unDraw drew nearly black, which is always the
 * line work and the figure.
 *
 * Skin becomes `--accent-wash` and the small bright props become the fill.
 * Flat art in one hue is a deliberate look; skin left at `#ffb6b6` on a lime
 * page is just an asset somebody forgot to finish.
 */
const PALETTE = new Map(
  Object.entries({
    '#fff': 'var(--ground)',
    '#ffffff': 'var(--ground)',
    '#f2f2f2': 'var(--surface)',
    '#f0f0f0': 'var(--surface)',
    '#e6e6e6': 'var(--surface-lift)',
    '#e4e4e4': 'var(--surface-lift)',
    // The subject: whatever the drawing is actually of — the safe, the piggy
    // bank, the shirt on the person holding the card. This is the highlight,
    // so it is the brand at full strength, and it is the only lime in the
    // frame. Everything the subject sits on stays neutral above.
    '#dadada': 'var(--accent-fill)',
    '#d6d6e3': 'var(--accent-fill)',
    // Its shadow side and the second-tier props. The deep green is the other
    // half of the brand pair, and lime over forest is the contrast the product
    // uses everywhere else — a filled button, a chip, the trend line.
    '#ccc': 'var(--forest)',
    '#cccccc': 'var(--forest)',
    '#cacaca': 'var(--forest)',
    '#3f3d56': 'var(--ink-soft)',
    '#2f2e41': 'var(--ink)',
    '#2f2e43': 'var(--ink)',
    '#090814': 'var(--ink)',
    // Skin, in the four shades unDraw scatters across a set. `--ink-faint` and
    // not `--accent-wash`, which was the first try: the wash sits a hair above
    // the ground in light and a hair above the hairline in dark, so on black
    // the face landed at the same value as the clothing and the figure lost
    // its head. The faint ink is mid in both grounds, which is what skin has to
    // be when the clothes are pale in one theme and dark in the other.
    '#ffb6b6': 'var(--ink-faint)',
    '#ffb7b7': 'var(--ink-faint)',
    '#ffb9b9': 'var(--ink-faint)',
    '#ed9da0': 'var(--ink-faint)',
    // The one thing in the frame that is meant to be looked at.
    '#ff6584': 'var(--accent-fill)',
    '#fbd56f': 'var(--accent-fill)',
  }),
);

/** `undraw_welcome-cats_tw36.svg` -> `WelcomeCats`, `owe.svg` -> `Owe`. */
function componentName(file) {
  return basename(file, '.svg')
    .replace(/^undraw[-_]/, '')
    .replace(/_[a-z0-9]{4,6}$/, '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('');
}

function toComponent(svg, name, source) {
  let body = svg;

  // Attribution and the file's own name: kept in the header comment below,
  // where it is readable, rather than as attributes React would pass straight
  // through to the DOM.
  body = body.replace(/\s(?:artist|source)="[^"]*"/g, '');
  // `role="img"` on something also marked `aria-hidden` is two answers to the
  // same question. The hiding is the one that is meant.
  body = body.replace(/^(<svg[^>]*?)\srole="img"/, '$1');
  body = body.replace(/<title>[\s\S]*?<\/title>/g, '');

  // Sized by the element that places it, so the intrinsic dimensions would
  // only be a fight to override. The viewBox is what has to survive.
  body = body.replace(/^(<svg[^>]*?)\s(?:width|height)="[^"]*"/g, '$1');
  body = body.replace(/^(<svg[^>]*?)\s(?:width|height)="[^"]*"/g, '$1');

  body = body.replace(/xmlns:xlink=/g, 'xmlnsXlink=');
  body = body.replace(/style="isolation:isolate"/g, "style={{ isolation: 'isolate' }}");

  for (const [from, to] of PALETTE) {
    body = body.replace(new RegExp(`"${from}"`, 'gi'), `"${to}"`);
  }

  const missed = [...new Set(body.match(/"#[0-9a-fA-F]{3,8}"/g) ?? [])];
  if (missed.length > 0) {
    console.warn(`  ${name}: unmapped ${missed.join(', ')}`);
  }

  // Decoration, and named by the page that places it. A screen reader that
  // walks into "a person standing beside a large phone" has been given a
  // description of the furniture instead of the question on the screen.
  body = body.replace(
    /^<svg/,
    '<svg aria-hidden="true" focusable="false" className={className}',
  );

  return `/*
 * Generated by scripts/build-illustrations.mjs from ${source}.
 * Do not edit: the next run overwrites it. Change the source or the palette
 * map in the script instead.
 *
 * Illustration by Katerina Limpitsouni, https://undraw.co.
 */
export function ${name}Art({ className }: { className?: string }) {
  return (
    ${body}
  );
}
`;
}

const files = (await readdir(SOURCE)).filter((f) => f.endsWith('.svg')).sort();
await mkdir(OUT, { recursive: true });

for (const file of files) {
  const name = componentName(file);
  const svg = (await readFile(join(SOURCE, file), 'utf8')).trim();
  const out = join(OUT, `${name.toLowerCase()}.tsx`);
  await writeFile(out, toComponent(svg, name, `${SOURCE}/${file}`), 'utf8');
  console.log(`${file} -> ${out} (${name}Art)`);
}
