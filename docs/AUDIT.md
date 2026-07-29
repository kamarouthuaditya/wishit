# Wishit — feature audit

State of the app as of 28 July 2026, after accounts were added. Every claim
below was checked against the code, and file references are given so nothing has
to be taken on trust. Severity is about consequence, not effort:

- **S1** — produces a wrong number, loses data, or exposes it
- **S2** — misleads, or makes a feature useless in practice
- **S3** — friction, polish, absent affordance

---

## 1. What exists

| Area      | Route                                                        | State                                                                                                                                       |
| --------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard | `/`                                                          | Balance left, corpus, runway, goal health, cashflow waterfall, 12-month projection, this-month log card, upcoming payments, net-worth trend |
| Wishlist  | `/wishlist`, `/wishlist/[id]`                                | Items, multi-item scenarios, purchase-impact analysis, delay-to-goals                                                                       |
| Goals     | `/goals`                                                     | Goals, contributions, savings lines, transfers between goals, lifecycle (done / stop date / until full), savings-pace table                 |
| Expenses  | `/expenses`                                                  | Fixed and variable budget lines, categories, frequency, effective dates, card tagging, live planner                                         |
| Spending  | `/spending`                                                  | Daily log, month navigation, day grouping, category breakdown vs budget, CSV export                                                         |
| Loans     | `/loans`                                                     | EMIs, amortisation, prepayment impact, no-cost-EMI true cost                                                                                |
| Cards     | `/cards`                                                     | Cards, limits, utilisation, tagged expenses                                                                                                 |
| Review    | `/review`                                                    | Budget vs actual, surplus variance, goal and wishlist review, month close-out                                                               |
| Setup     | `/setup`                                                     | 12-field wizard                                                                                                                             |
| Auth      | `/login`, `/signup`, `/forgot-password`, `/account/password` | Email + password, reset flow, per-user RLS                                                                                                  |

Engine: `lib/engine/` — 36-month simulation, waterfall, goal allocation
(waterfall / fixed / proportional), purchase impact, amortisation, savings
plans. 168 tests.

---

## 2. Loopholes

### ~~S1 — Card tagging does nothing~~ — resolved

Tagging now means something. A logged spend can carry a card (`transaction.paid_by_card_id`, migration 0007), and `lib/model/cards.ts` turns that into statement cycles: what is closed and payable, what is still accruing, and the date each falls due. The cards page and the dashboard's due list read those figures instead of a hand-typed `current_bill`.

Deliberately _not_ an extra outflow: a ₹2,000 dinner is the same ₹2,000 whether it leaves on Tuesday or on the 5th. The card changes the timing, so timing is all it models.

### ~~S1 — Net worth ignores debt repayment~~ — resolved

`currentFacts` now amortises each loan from its start date before subtracting it (`outstandingToday` in `lib/snapshot.ts`): every elapsed payment is split into interest on the balance and principal off it. Net worth improves as EMIs are paid, which it never did before.

### ~~S1 — Two different definitions of "actual spending"~~ — resolved

`buildReview` now runs through `buildActuals` like everything else, so a category with no entries counts at its budget and only what you actually recorded can beat it. Logging one ₹400 coffee no longer makes the month look nearly free. `buildReview` takes an optional `now` so the pace estimate can be pinned in tests.

### ~~S2 — CSV import duplicates on re-import~~ — resolved

The importer had no dedupe key, no dry run, and no report of what it skipped, so
importing the same statement twice doubled the month. It has been removed and
replaced by CSV export (`app/spending/export/route.ts`): a month or the lot,
RFC 4180 quoting, RLS-scoped so an export cannot contain what a page could not
show. If import returns it needs a dedupe key and a preview before it writes
anything.

### S2 — Goal `weight` and allocation modes are invisible machinery

`allocation_mode` is a profile-wide setting (`app/goals/page.tsx`), and `weight`
appears only inside a goal's Edit panel with the hint "Used by proportional
allocation". Nothing anywhere shows what changing either would do, and
`proportional` ignores priority entirely (`lib/engine/simulate.ts`, `allocate`).
A user cannot predict the effect of a control, so they will not touch it.

**Fix:** show the split — "with this mode, next month's ₹13,100 goes: Emergency
₹15,000, Laptop ₹0" — beside the selector, recomputed per mode.

### S2 — Corpus is a number you maintain by hand

`profile.liquid_corpus` is only ever set by the setup wizard or the review's
correction field. Nothing reconciles it against income minus spending, and the
monthly snapshot records whatever it says at the time (`lib/snapshot.ts:35`).
Forget to update it for three months and every runway, floor and net-worth
figure quietly drifts.

**Fix:** at month close, offer the computed figure — `corpus + inflow − actual
outflow` — as a default the user can accept or overwrite.

### S2 — Snapshots only exist for months the app was opened

`ensureMonthlySnapshot` writes the current month on a dashboard visit. Skip
August entirely and there is no August row, ever — the trend chart simply has a
hole, and `previousSnapshot` compares against whatever it finds instead.

**Fix:** on load, backfill missing months between the last snapshot and now from
the simulation, flagged as reconstructed rather than observed.

### S2 — "Close out month" now duplicates automatic behaviour

Since the current month's snapshot refreshes itself, `closeOutMonth`
(`lib/actions.ts`) does the same thing on demand. Two paths to one outcome, and
the button implies a ceremony the app no longer needs.

**Fix:** make it "lock this month" — freeze the row so later edits stop moving
history — or remove it.

### S2 — A purchased wishlist item changes nothing

Marking an item `purchased` removes it from the baseline (only `committed` items
are simulated, `lib/model/to-engine.ts:166`). It does not debit the corpus,
create a loan for an EMI purchase, or leave a transaction. The thing the whole
app is built to decide has no consequence when you actually do it.

**Fix:** on purchase, offer to write the transaction, adjust the corpus, and
create the loan row for an EMI.

### S3 — Deletes are instant and unrecoverable

No `confirm` anywhere in `app/`. One click removes a goal with its balance, a
loan with its schedule, or an expense line. Goals at least have "Mark done" as a
soft option now; nothing else does.

**Partly done.** `ConfirmButton` arms in place rather than opening a modal, and is wired into logged spends. Goals, loans, cards and expense lines still delete on one click.

### S3 — Dead schema

`goal_contribution`, `simulation_run` and `career_entry` are created, RLS'd, and
never read. `scenario` is listed once in `loadSnapshot` and never used again
(`lib/db/repository.ts:52`). Dead tables invite drift.

### S3 — Money is floating point end to end

Every amount is a JS `number` and Postgres `numeric` read back as float.
Rounding is applied at display time only. At Indian salary scale this will not
bite soon, but goal completion months are computed by interpolation and small
drift accumulates.

### S3 — Timezone and currency assumptions

Dates come from `new Date()` on the server. Deployed anywhere other than IST,
"today" can be yesterday for the user, which moves month boundaries and
`daysElapsed`. `profile.currency` exists but nothing reads it; `₹` and `en-IN`
are hardcoded in `lib/format.ts`.

### ~~S3 — Transactions cannot be edited~~ — resolved

Every row on the spending page opens into the fields it was created with — date, amount, category, note, card, one-off — via `updateTransaction`.

---

## 3. Security, after accounts

What is now right: every table has `user_id` with a `default auth.uid()`, a
single all-verb RLS policy per table, and the app connects as the signed-in user
rather than with the service-role key (`lib/db/driver.ts`). Application code
contains no `where user_id = ...`, so there is no filter to forget — Postgres
refuses to hand over rows in the first place. The proxy redirect is cosmetic;
the boundary is the policy.

Still open:

- **Service-role key is still in `.env.local`** and is used by `scripts/*.mjs`.
  Rows those scripts write land with `user_id = null` and are then invisible to
  everyone. Either teach the scripts to take an owner, or retire them.
- **No account deletion, and export covers only spending.** Transactions can now
  be exported; expenses, goals, loans, cards and wishlist cannot. Deletion is a
  legal requirement in several jurisdictions and does not exist at all.
- **No rate limiting beyond Supabase defaults** on sign-in or reset requests.
- **Email enumeration** is handled on sign-in and reset (deliberately vague
  replies), but `signUp` returns Supabase's raw error, which can differ for an
  existing address.
- **No session-expiry UX.** When a token cannot refresh, the next action fails
  with a thrown error rather than a "you were signed out" message.

---

## 4. UX friction

Ordered by how often it bites.

### The first ten minutes have no thread

Sign up → setup wizard (12 fields, including expected return, inflation and
projection horizon) → dropped on a dashboard where every figure is zero. Nothing
says what to do next. The three things that make the app work — expenses, one
goal, one wishlist item — are each one nav click away and nothing asks for them.

**Fix:** a checklist on the dashboard until it is complete: _Add your expenses ·
Set one goal · Add something you want_. Move return/inflation/horizon out of
setup into Settings with sane defaults.

### Editing expenses is one form per row

Each budget line is its own `<form>` with its own Save (`app/expenses/page.tsx`).
Correcting seven lines is seven round trips, each re-rendering the page. The
running planner at the bottom updates live from the inputs, which sets an
expectation of directness that the Save buttons then break.

**Fix:** one form for the table with a single Save, or autosave on blur with an
undo toast.

### Every list is a form, and forms look like data

The same input styling is used for editable fields and for read-only figures, so
a page of expenses reads as a spreadsheet you must fill in. Compare the goals
page, where the numbers are text and editing hides behind "Edit" — that reads
far calmer. The expenses and cards pages should follow it.

### The goal card carries five jobs

Progress, contribution, transfer-in, savings pace, lifecycle, and edit — stacked
vertically, all expanded, for every goal. With three goals the page is enormous
and the important line (what this goal needs per month) is buried mid-card.

**Fix:** collapse to a summary row per goal; expand one at a time.

### Scenario selection on the wishlist is invisible

Selecting items is a checkbox list that writes `?sim=a,b` and re-renders. There
is no affordance saying "select several to see them together", and no indication
that the numbers below changed because of the selection.

### Nine flat nav items

Dashboard, Wishlist, Goals, Expenses, Spending, Loans, Cards, Review, Settings —
no grouping, no active state, no indication of where you are. Three natural
clusters exist: **Plan** (expenses, goals, loans, cards), **Track** (spending,
review), **Decide** (wishlist).

**Fix:** group them, and mark the current page.

### Mobile is untested and probably poor

Tables set `min-width: 560–680px` and scroll horizontally inside a viewport that
is often 390px. The sticky header plus balance strip eats ~110px before content.
The daily-logging journey — the one thing people do on a phone — has not been
looked at on one.

### Nothing confirms that anything happened

Server actions revalidate and the page re-renders with new numbers, which is
elegant but silent. Saving an expense, transferring between goals, and importing
a CSV all look identical to nothing happening.

**Fix:** a toast, or a brief highlight on the row that changed.

### Empty states are dead ends

`<Empty>` states say what is missing but rarely offer the action —
"No goals yet. Add one below." with the form 400px further down.

---

## 5. Charts and presentation (for later)

Noted, not built. Current visual vocabulary is one Recharts line
(`components/trend.tsx`), progress bars, and tables.

**Highest value first:**

1. **Cashflow waterfall** — the dashboard's central card is a `<dl>` of numbers
   that is literally a waterfall. Draw it as one: income bar, deductions
   stepping down, balance left standing.
2. **Spending by category, over time** — stacked area across months answers "is
   food creeping up?", which no current view does.
3. **Goal timeline** — each goal a horizontal bar from today to projected
   completion, with the target date marked. Makes "behind target" visible
   instead of stated.
4. **Balance-left sparkline in the header strip** — twelve months of context in
   60px, next to the number everything else is measured against.
5. **Calendar heatmap on `/spending`** — daily intensity for a month; the
   natural way to see "we ate out every Friday".
6. **Purchase impact** — currently a table of corpus deltas at checkpoints;
   should be two lines diverging, baseline vs scenario, with the goal-completion
   dates marked on both.

**Presentation notes:** the table-heavy pages (review, projection, amortisation)
need a chart-first / table-behind-disclosure treatment. Colour is used
semantically already (good/warn/bad) and consistently — keep that discipline
when charts arrive, and do not introduce a second palette. Every chart needs a
plain-language sentence under it, in the voice the app already uses.

---

## 6. What I would do next, in order

1. Point the review at `buildActuals` — two answers to one question is the worst
   defect in the app.
2. Amortise debt in net worth.
3. Make card tagging real, or remove it.
4. Onboarding checklist plus a lighter setup wizard.
5. Export the rest of the data, not just spending.
6. Purchase completion: buying something should write itself into history.
7. Confirmations on destructive deletes.
8. Group the navigation, mark the active page.
9. Mobile pass on the daily-logging journey.
10. Account deletion and data export.

## 7. Future Prospects

1. shortcuts app for ios that directly enters the expense and people can log it
2. ~~black and dark green theme~~ — shipped as `data-theme="money"`
3. splash screens for setting up necessary items like, income, balances, goal (optional).
4. add info button on all pages, for example expenses and spending seem same to same how would some one make out a difference
