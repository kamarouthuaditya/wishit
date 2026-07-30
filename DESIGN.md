# Wishit — design system

Sharp-edged, typographic, lime. Playfair headings against Montserrat figures,
and not one rounded corner anywhere. Three grounds: **light is the default**,
dark and money are deliberate choices.

## Scenes

The product is used in two places, and each one picks its own ground. Money is
the third ground and the only one chosen for how it looks rather than for where
it is read.

**Light — the default, and the fifteen-second use.** 8:40am on a train, phone at
full brightness in daylight, logging the ₹340 breakfast before it is forgotten.
Glare is the constraint: it eats thin lime strokes and washes out a delicate
hairline, so light runs heavy ink, firm rules, and an accent that arrives as a
block.

**Dark — the ten-minute decision session.** 11pm, lamp on, deciding whether the
thing in the cart is worth three months of the emergency fund. Dark is the
actual ambient light there, and it keeps a single lime figure the brightest
thing on screen.

**Money — the same session, in the currency's own colours.** 11pm again, but
the choice is aesthetic, not ambient: black, with note green kept for the
buttons and the figures that matter. It is the one theme that leaves the brand
hue, and it is not dark with the hue nudged — the accent split runs the other
way. Where dark makes lime the brightest thing on screen, money prints the block
deep and puts the pale label on top, the way a note is engraved.

Light applies unless `data-theme` is set on `<html>` to `dark` or `money`. The
OS preference is deliberately ignored: a system setting made for a code editor
is not a statement about this app. The choice lives in `localStorage` under
`wishit-theme`, is set from the account page, and is applied by an inline script
in the layout before first paint. An unrecognised stored value falls back to
light, which is also what a thrown exception gets.

## Color

Strategy: **restrained**, deliberately. One accent doing real work, a green for
tinted ground, and neutrals tinted toward the same hue so nothing reads as grey
plastic.

The accent splits into two roles, because lime is 10.5:1 under dark ink and
1.4:1 as text on paper. Same brand colour, two jobs:

| Role | Light | Dark | Money | Use |
|---|---|---|---|---|
| `--accent` | `oklch(0.470 0.118 138)` deep leaf | lime | `oklch(0.660 0.135 158)` note green | Anything **drawn thin**: text, 1px rules, chart lines, focus ring, bars |
| `--accent-fill` | lime | lime | `oklch(0.420 0.115 158)` deep note | Anything **drawn as a block**: primary buttons, selected segment |
| `--on-accent` | `oklch(0.250 0.055 138)` | `--ground` | `oklch(0.960 0.018 158)` | The label sitting on `--accent-fill` |
| `--accent-wash` | `oklch(0.895 0.090 138)` | `--forest` | `--forest` | Tinted ground: avatars, chips, selection |
| `--accent-edge` | `--accent` | `--accent-fill` | `--accent` | The hairline that keeps a block a shape when its fill is close to its page |
| `--accent-press` | `--accent` | `--forest` | `--accent` | The plate that fills a primary button on hover — the accent's opposite pole |
| `--on-accent-press` | `--ground` | `--lime` | `--ground` | The label once the plate has arrived |

Ground and ink, which invert their ladder rather than their meaning:

| Role | Light | Dark | Money | Use |
|---|---|---|---|---|
| `--ground` | `#F9FDF5` → `oklch(0.990 0.012 127)` | `#090b07` → `oklch(0.145 0.010 132)` | `oklch(0.145 0.005 158)` | Page, and the field an input sits in |
| `--surface` | `oklch(0.968 0.018 127)` | `oklch(0.212 0.012 132)` | `oklch(0.210 0.006 158)` | Panels |
| `--surface-lift` | `oklch(0.945 0.024 127)` | `oklch(0.268 0.014 132)` | `oklch(0.265 0.007 158)` | Hover, active row |
| `--ink` | `oklch(0.255 0.026 140)` | `#EAFFD0` | `oklch(0.940 0.006 158)` | Primary text (14.7:1 light, 18.5:1 dark, 16.6:1 money) |
| `--ink-soft` | `oklch(0.455 0.020 138)` | `oklch(0.800 0.022 122)` | `oklch(0.780 0.006 158)` | Secondary text |
| `--ink-faint` | `oklch(0.520 0.019 136)` | `oklch(0.650 0.016 122)` | `oklch(0.640 0.006 158)` | Labels, hints — AA on its ground in all three |
| `--line` | `oklch(0.830 0.022 127)` | `oklch(0.325 0.015 132)` | `oklch(0.330 0.006 158)` | Hairlines |
| `--line-strong` | `oklch(0.700 0.030 127)` | `oklch(0.415 0.019 132)` | `oklch(0.430 0.007 158)` | Emphasis borders |

Money's whole ladder is neutral, and that is the theme's rule rather than a
detail: **green is reserved for the block and the figure.** Buttons, chips,
selection, the trend line, a highlighted number. Everything a note is printed
on — page, panels, hairlines, all three inks — is a shade of black or grey at
chroma 0.005–0.007, off `#000` without reading as tinted. It is the only theme
in the product whose ground does not carry the accent hue.

In dark the panel sits **above** the page and an input is a darker well below
it. In light the page is the lightest thing and panels sit just below it, so the
same input reads as a white field cut into the panel. The relationship is
identical; only the direction flips.

Light is a **white base carrying a wash of the brand**, not a green page.
`#EAFFD0` diluted into white gives `#F9FDF5`, which reads as tinted without
being nameable, and the panels step down from it by ~2%. Full-strength
`#EAFFD0` is deliberately not used as a ground: across a whole page it stops
being an accent and becomes the product's only idea, and on a white base it is
too pale to work as a chip either. The brand colour proper is kept for the
things that must be seen — the lime block, `--accent-wash` chips, selection.

Separation in light is small in lightness terms (panel is 1.06:1 against the
page), which is why `--line` carries more of the work there than it does on
black.

Semantic, and only ever used to mean something:

| Role | Light | Dark | Money | Meaning |
|---|---|---|---|---|
| `--good` | `--accent` | lime | `--accent` | On track, positive balance |
| `--warn` | `oklch(0.545 0.110 72)` | `oklch(0.800 0.130 78)` | `oklch(0.800 0.130 78)` | Tight, behind pace |
| `--bad` | `oklch(0.515 0.180 25)` | `oklch(0.680 0.170 25)` | `oklch(0.680 0.170 25)` | Negative, breach, destructive |

Warn and bad are shared between dark and money on purpose. They are not brand
colours, they are meanings, and a theme is not a licence to restate what
"behind pace" looks like.

The first two grounds are the same idea seen twice. `#EAFFD0` is the brand's
pale wash: it is the primary **text** colour on the dark page, and the **page**
itself in light. Neither ground is neutral — dark is a *tinted* near-black
(`#090b07`), not `#000`, carrying just enough green to belong to the accent
rather than read as a grey chassis. Nothing anywhere is `#000` or `#fff`.

Dark's page used to sit at `#12150f`, and that was a lifted charcoal rather than
a black. Lifting the ground costs every bright thing standing on it — the hero
figure, a lime link, a warning — the contrast that makes the theme feel lit at
11pm, and it is why highlights read muted. Dropping it to `#090b07` buys about
7% on every ratio in the theme.

Two colours this dark are closer in luminance than the same lightness gap higher
up, so the steps widen rather than stay even — 6.7 and 5.6 points against the
old 4.5. Counter-intuitively the panels separate **better** afterwards, 1.12 and
1.17 against 1.11 and 1.14, on a page that is genuinely black.

Money sits at `#080b09`, effectively the same depth, and gets there without the
hue. Withholding it from the ground costs the ladder its cheapest separator, so
value does all of the work: the same wide steps, none of the tint helping them
apart, and the hairlines lifted to match.

The drawable green has a floor, and it is a floor rather than a preference:
`--accent` is text, so it has to clear 4.5:1 on a **hovered row**, not merely on
the page. At L 0.640 that lands at 4.4:1, so 0.660 is as dark as a highlighted
figure can be. The genuinely dark green — the one that looks like a note — lives
on `--accent-fill`, where nothing has to be read through it and a pale label
sits on top instead.

One consequence to hold on to, and it has two forms. On a lime-washed page, lime
is 1.4:1 against its own ground. On money's black page, the deep fill is 2.5:1
against its ground. Either way a *flat* block stops being a shape, which is what
`--accent-edge` used to solve — a hairline in both those themes, and in dark a
hairline set to the fill so it vanished.

That hairline is still the answer, and it briefly was not. While the button
carried a gradient the edge had to go — a flat line can only match a gradient at
one stop, so dark's invisible edge stopped being invisible and started outlining
the plate. The fill is flat again, so the original trick works again: a hairline
in light and money, and in dark an edge set to the fill so it disappears.

Accounts can override `--lime` and `--forest` at runtime; nothing else is
allowed to change. Every accent role above is derived from `--lime` with
relative colour syntax (`oklch(from var(--lime) …)`), so a custom accent moves
the whole family at fixed lightness and can never land as unreadable text. Money
remaps `--lime` itself to the note green and derives from there, which is why
the theme is a colour change and not a second set of rules.

## Typography

- **Playfair Display** — headings, page titles, hero figures. High-contrast
  serif against a technical interface: the one piece of warmth in the product.
- **Montserrat** — body, labels, controls, all numbers. Tabular figures on
  every amount (`font-variant-numeric: tabular-nums`).

Scale, ratio ≥1.25 between steps: 12 / 13 / 15 / 18 / 24 / 34 / 48. Body 15px,
line-height 1.5, measure capped at 68ch. Headings tighten to 1.05–1.15 and
`letter-spacing: -0.02em`. Labels are 12px, uppercase, `letter-spacing: 0.08em`,
in `--ink-faint`.

Never Playfair below 18px, and never for numbers in a table.

## Shape

**Zero border radius. Everywhere.** Inputs, cards, buttons, pills, dialogs,
charts, the focus ring. If something needs to read as separate, it gets a
hairline, a background shift, or space, never a curve.

Cards are not the default answer, but **a list of rows is a container**. A
hairline rule plus a faint label was the original grouping, and on a page of
rows it failed: every separator on the screen was the same 1px `--line`, so the
rule between two rows and the rule between two sections carried identical
weight, and nothing said where a group ended. `Section` is the answer — 1px
`--line` border, `--surface` fill, a header band on `--surface-lift` divided by
2px of `--line-strong`, rows inside separated by hairlines. Where a panel of
prose or figures is warranted, `Card` still applies: same border and fill,
20–24px internal rhythm.

**Inside a section, every ground token is spent once.** The header band is the
only `--surface-lift`; rows sit on the panel's `--surface`; a row under the
pointer, or open, drops to `--ground`. The band and the row hover were both
`--surface-lift` at first, which meant a pointer anywhere in the list put a
second identical band on screen and the heading stopped reading as a heading.
A row going *down* is also the truer direction: it is opening a well, not
rising off the panel.

Still no nested panels. One border level: what opens *inside* a section — an
edit form, an expanded row — is that same **well**, not a second box. It sits
on `--ground` and spans the full width by cancelling the body padding
(`-mx-5 px-5`), continuous with the row that opened it, so the pair reads as one
thing.

The band carries two signals, not one, because in light the fills are ~2% apart
and a ground shift alone would not survive glare: `--surface-lift` **and** a 2px
`--line-strong` rule under it, with the section's figure at 17px against the
rows' 15px.

**A field that does not apply is absent, not greyed out.** The wishlist form
disabled its five payment fields when the mode did not use them, so paying cash
meant reading five dead controls — a form asking questions it had already
decided were irrelevant. Unmounting keeps the property that made disabling
attractive: an absent control is not submitted, so switching from EMI to cash
still clears the EMI figures rather than leaving stale numbers behind. Keep
`muted` for a field that is temporarily unavailable and will come back; drop the
field when it belongs to a branch you are not on.

**A form's fields are grouped, and the groups are named.** Twelve controls in one
flat four-column grid put "Tenure (months)" at the width and weight of "Reason"
and said nothing about which fields move together. Group by the question being
answered, each under a 12px `.section-title` with a hairline above it.

**Editing is a disclosure; creating earns a dialog.** Everything that changes an
existing row opens under that row, because the row is the context and a modal
would hide the figure being changed. Creating has no row to sit under, and the
alternative was a two-field strip that bought its brevity by omitting eight
fields, so every goal arrived half-specified and had to be opened and edited
immediately. `Dialog` wraps the platform's `<dialog>` — focus trapping, `Esc`,
the top layer and `aria-modal` come free, and the top layer is the only way to
be sure a sticky bar cannot paint over it. It carries the same header band as a
`Section`. This is the one modal in the product; a second one needs an argument
this good.

**Buttons come in two sizes, and rank is what picks one.** `md` (`px-4 py-2`,
13px) is a page's own action — the thing the screen exists for. `sm` (`px-3
py-1.5`, 12px) is an action on one row: a Save beside a 14px field, repeated
down a list. Every row action was `md`, so a section of six rows carried six
buttons at the weight of the page's primary action, and the eye had nowhere to
rest. The uppercase tracking eases with the size (0.06em → 0.05em), because
letterspacing tuned for 13px reads as a gap at 12px.

**A section heading is ink; a field label is faint.** Both were 12px caps in
`--ink-faint`, which put `FIXED` at the weight of the word `general` under a
row — a heading losing to the rows it introduces. `.section-title` is 13px/700
in `--ink`; `.eyebrow` stays 12px/600 in `--ink-faint` and only ever names the
control beneath it.

## Depth

Not shadows: this is a flat, high-contrast system. Depth comes from

1. **Layered ground** — `--ground` page, `--surface` panel, `--surface-lift` on
   hover.
2. **Hairlines** — 1px `--line` doing the separating.
3. **Icons** — 16/20px stroke icons (1.5px, `currentColor`) that label a
   section or an action. Never emoji, never decorative-only.
4. **A single accent edge** — a 2px top rule in `--accent` on the one element
   that matters on a screen. Used at most once per view.

In light the ladder steps are small (~2–3%) and the hairlines carry more of the
work, because a 1px rule at the dark theme's relative weight disappears in
glare. Dark and money both run wide steps on a near-black page (6.7/5.6 and
6.5/5.5) because two colours that dark sit closer in luminance than the same
gap higher up. Each theme is tuned on its own ground; none is another one
inverted.

**The primary button fills from the edge the pointer crossed.** On enter the
plate snaps collapsed against the nearest edge with no transition, reflows, then
grows to `inset(0)`; on leave it retreats toward the edge the pointer left by.
The label inverts to `--on-accent-press` while the plate is still travelling, so
the colour crosses with the fill rather than snapping when it lands.

`clip-path`, not a transform. The plate animates in place with no compositor
layer of its own, so it cannot drift a subpixel off the square corners and leave
a seam down the edge it came from.

**The plate is the accent's opposite pole, and which pole that is flips by
theme.** Light and dark start from a bright block, so the plate is the dark
green and the label goes pale. Money starts from the dark block, so its plate is
the *drawable* accent and the label goes to the page. Deriving money's plate the
same way as the others put it at 1.46 against a black page — a button that
disappears at the moment you touch it.

Three things get checked, not one. The label has to clear 4.5:1 on the incoming
plate (worst 6.35:1); the plate has to stay a shape against the page now that a
filled button has no fill of its own to be seen by (worst 1.78, dark); and the
plate has to differ enough from the resting fill for the motion to register at
all (worst 2.68, money).

This replaced a metallic gradient — a five-stop brushed sheen that swept across
the block on a loop. It is gone rather than parked: `.metal`, `.text-metal`,
their keyframes and `--t-metal` are all removed, and the page titles that wore
`.text-metal` are back to `--ink`. Two notes survive it, because both cost real
time to learn. A deep gradient on a 38px control reads as a seam splitting the
button, not as a surface — that shape needs a large pill to turn over on. And a
highlight that crosses a control and restarts has a *direction*, which reads as
loading; reversing it is what buys calm, not shrinking it.

**The highlight raises chroma with lightness, never lowers it.** Desaturating a
highlight is the conventional move and it is wrong here. The reference does it
(`c * 0.72`) and on gold it reads as champagne; on lime at L 0.9 it reads as
white, and a white band across the one lime block in the product drowns the
colour it exists to light. Measure it by the weakest channel: the fill's is
0.322, the desaturated highlight's was 0.583 — nearly doubling it is exactly
what "washed out" means. The stops now run `c * 1.05`, landing at 0.379.

The 1.05 is not a flourish. Chroma has to climb a little as lightness does, just
to keep saturation *perceptually* level, so a flat `c` would drift pale on its
own. Any accent added later inherits this: lift lightness, lift chroma with it.

## Motion

Purposeful, short, and off by default when the user asks for that.

- Durations: 140ms (state), 220ms (enter), 320ms (panel), 420ms (hover fill).
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` — ease-out-expo. No bounce, no spring.
- Animate `opacity`, `transform` and `clip-path` only. Never width, height,
  top, or left.
- Buttons: 90ms press to `scale(0.985)`, and on the primary block a 420ms fill
  that enters from the edge the pointer crossed and leaves by the edge it
  exits. Still no lift and nothing cast.
- **Nothing animates perpetually.** Every animation is a response to something —
  a press, a pointer, an entrance, a figure that changed. A loop that runs
  whether or not anyone did anything competes with the numbers for attention,
  and the numbers are the product.
- Lists: 40ms stagger, `translateY(6px)` to 0, capped at 8 items.
- Numbers that change after an action get a 400ms lime flash on their
  background, then nothing.
- `prefers-reduced-motion: reduce` disables all of it and keeps the end state.

Smooth scrolling: `scroll-behavior: smooth` with the same reduced-motion guard,
and `scroll-margin-block` on anchor targets so a heading never lands under the
sticky header.

## Data display

Every amount is `tabular-nums`, right-aligned in tables, never wrapped. Tone follows
meaning: `--bad` for negative, `--good` for a balance that survives, plain
`--ink` for a neutral figure. A row highlights on hover and shows its actions
there — to `--ground` inside a `Section`, where lift belongs to the header
band, and to `--surface-lift` on a bare table that has no band to compete with.

Charts inherit the same palette: `--accent` for the actual line, `--chart-fill`
for its area, `--ink-faint` hairlines for axes, `--bad` dashed for the emergency
floor. Never more than two hues in one chart. `--chart-fill` carries its own
value per theme — forest at 55% on the dark ground, 60% on money's blacker one,
and in light the drawable `--accent` at 28%, since lime over a lime page is
invisible. A wash tuned for one ground disappears on the others.

## Anti-patterns for this codebase

- Rounded corners of any radius.
- A card wrapping a single number.
- A `select` with no border of its own, sitting in a joined strip. The arrow
  becomes the only sign it opens anything. Controls without labels get their
  own box.
- `<input list>` standing in for a dropdown. It is a combobox on paper and a
  plain text field on screen, so people type three spellings of one category
  into what is meant to be a closed set. Use a real `select`, with an option
  that swaps in a text field when the set genuinely needs a new member.
- Gradient text, glassmorphism, coloured side-stripes on panels.
- Emoji standing in for icons.
- Two figures on one screen claiming to be the same thing and disagreeing.
- Lime as text, as a 1px rule, or as a chart line. On paper it is 1.4:1. Reach
  for `--accent`; lime is only ever a block with `--on-accent` on it.
- `text-paper` on a `bg-accent-fill` control. It is the page ground, which is
  near-white in light and near-black in money, and either way it makes the
  primary button unreadable. `text-on-accent` travels with `bg-accent-fill`.
- Assuming `--accent-fill` is the light end of the accent. It is in two themes
  and the dark end in money. Anything that has to sit on it uses
  `--on-accent`, never a hard-coded ink.
- A colour that only works on one of the three grounds. Every token is declared
  in every theme, and no theme is checked without the other two.
- Neon on black. Money is a banknote, not a terminal: hue 158, chroma ≤ 0.145,
  no glow, no acid green. The saturation is the whole difference between this
  theme and the crypto dashboards the product is defined against.
