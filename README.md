# Wishit

> If I buy this, what does it cost me in time?

Every module exists to make that answer accurate. Money is translated into
months of delay on your goals, using a month-by-month simulation rather than a
flat divide.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # engine test suite
```

It works immediately on a local JSON store at `.wishit/data.json` (gitignored).
A seeded example is already there — the worked example from the scope of work.
Delete the file to start clean.

## Switch to Supabase

1. Create a project, then run every file in `supabase/migrations/` in the SQL
   editor, in numbered order.
2. Copy `.env.example` to `.env.local` and fill it in.

The app falls back to the local JSON store unless `NEXT_PUBLIC_SUPABASE_URL`
**and** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set — in development. In
production that fallback does not exist: a missing variable returns 503 naming
what is missing, because the alternative is one shared, sign-in-free ledger.
See `docs/DEPLOY.md`.

Every table has `user_id` and a row level security policy of `user_id =
auth.uid()`, and the app connects **as the signed-in user** (`lib/supabase/
server.ts`). Application code contains no `where user_id = ...` at all: a filter
can be forgotten, a policy cannot. The service-role key bypasses RLS and is used
for exactly three things — minting sign-up and reset codes, storing feedback
from people who are not signed in, and deleting an account. Never expose it to
the client or prefix it with `NEXT_PUBLIC_`.

To carry existing local data across, with an owner — rows written by the
service-role connection have no `auth.uid()`, so an unstamped row is invisible
to every account:

```bash
npm run db:push -- --owner you@example.com --dry-run   # show the plan
npm run db:push -- --owner you@example.com             # apply it
```

It refuses to run against an account that already has rows unless you pass
`--force`, so it cannot silently double up. `npm run db:reset -- --owner
you@example.com` clears one account and takes a backup first.

## The engine

`lib/engine/` is pure TypeScript with no I/O, no dates and no React. It takes an
`EngineInput` in month offsets and returns a simulation. Everything else — the
database, the pages — wraps it.

| File | What it holds |
|---|---|
| `simulate.ts` | The month-by-month loop, goal allocation, breach flags |
| `impact.ts` | Baseline vs scenario diff, time cost, confidence, mode comparison |
| `amortise.ts` | EMI formula, schedules, prepayment counterfactual, no-cost true cost |
| `waterfall.ts` | The cashflow waterfall and dashboard hero numbers |
| `period.ts` | The only place calendar dates meet the engine |

### Why the loop, not the divide

The worked example is a regression test (`tests/worked-example.test.ts`). With a
₹29,400 no-cost EMI and an ₹18,000 cash purchase against a ₹23,500 surplus:

- Flat divide: `(3,00,000 − 72,000) ÷ 18,600 = 12.3 months` → **misses the
  12-month deadline, red flag**
- Month-by-month: **11.0 months** → amber, still inside the deadline

Same inputs, opposite decision. The EMI ends in month 6 and surplus returns to
₹23,500; a flat divide cannot see that.

### The rupee-exact invariant

With returns at 0%, the corpus gap between baseline and scenario at any month
after all payments complete must equal total spend, to the rupee. Tested across
all four purchase modes.

## Decisions taken

| Decision | Choice |
|---|---|
| Stack | Supabase + Next.js, with a local JSON fallback so it runs before any cloud setup |
| Bonus | Both — stored once, `bonus_mode` switches the engine between lump-in-its-month and ÷12 |
| Returns / inflation | Fields exist in the loop, default 0. Keeps the rupee-exact test exact; turn them on in Setup |

## What is built

Phases 1–5 of the build order.

- **Setup** — income, corpus, emergency floor, engine settings
- **Dashboard** — surplus, corpus vs floor, runway, goal health, waterfall,
  12-month projection, breach flags
- **Expenses** — fixed / variable budget / investment lines with
  `effective_from` and `effective_to`, so a rent hike in month 5 lands in month 5
- **Loans** — real amortisation schedules, prepayment calculator with the
  investing counterfactual, no-cost EMI true cost
- **Goals** — priority, protection, three allocation modes, and the delay your
  committed wishlist has already cost each goal
- **Wishlist + Purchase Impact Engine** — all four purchase modes, time cost,
  3/6/9/12 checkpoints, breach flags, earliest safe date, derived confidence,
  mode comparison, and scenario stacking
- **Monthly Review** — budget vs actual per category, surplus achieved vs
  planned, goals on/off track, wishlist items that became affordable or slipped,
  and the one prompt that keeps the model honest
- **Transactions** — quick-add, CSV import, and a one-off flag so a single
  medical bill is never extrapolated across twelve months
- **Monthly snapshots + net worth trend** — see below

### Snapshots

`monthly_snapshot` gets one row per calendar month, written the first time the
dashboard is opened in that month and re-recordable from the review page. Trends
read those rows; nothing on a chart is recomputed from today's inputs, so editing
an expense cannot rewrite what the past looked like.

Net worth is `liquid corpus − outstanding debt − card bills`. Goal balances are
buckets *inside* the corpus, so they are never added on top.

Two definitions worth knowing, both tested:

- **Affordability is absolute.** `earliestSafeDelay` only counts breaches a
  purchase *introduces*, so on a baseline that already dips below the emergency
  floor everything would read as safe. The review instead asks: after buying
  this, does anything go red?
- **"Became affordable" is only claimed against a recorded snapshot.** With no
  earlier row there is no history, so no movement is asserted.

## What is not built

Deliberately deferred, in the spec's own order:

- Credit cards and Career Health (phase 6) — the tables exist, the pages do not
- What-if sliders and saved scenarios (phase 7)

Non-goals from the spec are untouched: no bank/SMS sync, no price tracking, no
tax planning, no live NAV, no multi-user.

## One known divergence from the spec

§4.5 defines confidence as worst-month buffer ÷ that month's surplus, banded
>25% high / 10–25% medium / <10% low. The §5 worked example labels a ₹1,100
buffer on an ₹18,600 surplus (5.9%) as *medium*; the stated rule makes it
**low**. The code follows the rule, since that is the normative definition —
adjust the bands in `confidenceFrom()` in `lib/engine/impact.ts` if you meant
the example.
