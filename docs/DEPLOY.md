# Deploying Wishit for testers

Written for Vercel plus a Supabase project, which is what this is set up for.
Order matters: the database has to exist before the first request, because the
app refuses to serve without it.

## 1. The database

Create a Supabase project, then run every file in `supabase/migrations/` in the
SQL editor **in numbered order**, `0001` through the highest-numbered file in
that directory. They are not idempotent
as a set — `0009` deletes duplicate profile rows and `0006` claims pre-account
rows for `aditya@onshorelabs.co.in` — so read the top of each before running it
on a database that already has data.

On a fresh project the claim step in `0006` is a no-op and prints a notice.
That is expected.

## 2. Email

Codes are minted by the app and sent over your own SMTP, because Supabase's
built-in sender is rate limited to a handful an hour.

For Gmail or Workspace: turn on 2-step verification, create an app password at
<https://myaccount.google.com/apppasswords>, and use the full address as
`MAIL_USER`. Gmail will send roughly 500 a day, which is generous for a closed
test and not a production mail system.

## 2b. Google sign-in

Optional. Leave `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` unset
and the button does not render at all — email and password is then the only way
in, and nothing is broken.

The handshake runs on this app's own domain rather than through Supabase's
relay. It is more code (`lib/google-oauth.ts`) and it buys one thing: Google
names the host it is about to return to on the consent screen, and
"ykzgptsgxhezjhytuzhy.supabase.co" is precisely the kind of string people are
taught not to trust. This way it reads as your own domain.

**Google Cloud console** → APIs & Services → Credentials → Create OAuth client
ID → Web application. Authorised redirect URIs — one line per host this build
answers on, all pointing at this app:

```
http://localhost:3000/auth/callback
https://<your-domain>/auth/callback
```

Google matches these byte for byte and does not accept wildcards, so every
preview domain you actually intend to sign in on needs its own line. The easier
route for previews is `NEXT_PUBLIC_SITE_URL` set to the production domain, which
pins the origin regardless of which host served the request.

Under **Authorized JavaScript origins**, add the same hosts without the path.

Configure the consent screen while you are there (External, your email as
support contact). A closed test does not need Google's verification review, but
it does need every tester's address added under Test users. Filling in the app
name and logo is what puts "Wishit" at the top of the screen.

**Supabase dashboard** → Authentication → Providers → Google: enable it, and
paste the client ID into **Authorized Client IDs**. Supabase never sees the
consent screen in this flow — it only verifies the ID token this app hands it,
and it will reject a token whose audience is not on that list. The client secret
belongs in the environment, not in the dashboard field.

Authentication → URL Configuration still wants a **Site URL** (the production
domain) for password-reset links. The **Redirect URLs** list no longer matters
for Google, because Google returns here and not to Supabase.

Copy the client ID and secret into the environment as `GOOGLE_OAUTH_CLIENT_ID`
and `GOOGLE_OAUTH_CLIENT_SECRET`. Neither is `GOOGLE_APP_PASSWORD`, which is
SMTP and unrelated.

## 3. Environment variables

Set these in the Vercel project, for Production **and** Preview:

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Publishable/anon key. Safe in the browser — RLS ties every row to its owner |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server only. Never prefix with `NEXT_PUBLIC_` |
| `MAIL_USER` | yes | The sending address |
| `GOOGLE_APP_PASSWORD` | yes | App password, not the account password |
| `FEEDBACK_EMAIL` | no | Where reports land. Defaults to `MAIL_USER` |
| `NEXT_PUBLIC_APP_TIMEZONE` | no | Defaults to `Asia/Kolkata` |
| `NEXT_PUBLIC_SITE_URL` | no | Forces the origin Google returns to. Leave unset and each deployment uses its own host |
| `GOOGLE_OAUTH_CLIENT_ID` | no | Web OAuth client. Unset, the Google button does not render |
| `GOOGLE_OAUTH_CLIENT_SECRET` | no | Its secret. Server only — never `NEXT_PUBLIC_` |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_FROM` | no | Defaults to Gmail on 465 |

If any of the five required ones is missing, a production deployment answers
503 with the names of what is missing rather than starting. That is deliberate:
without them the app would run on the local JSON file store, which has no
sign-in and one shared set of figures for every visitor.

## 4. Deploy

Vercel autodetects Next.js; no `vercel.json` is needed. `next build` runs
`tsc`, so a type error fails the deploy rather than shipping.

## 5. Check it before handing the link out

- [ ] `/login` loads and `/` redirects to it while signed out
- [ ] Sign up with a real address, and the code arrives
- [ ] Continue with Google returns to the dashboard, not to `/login?error=google`
- [ ] The dashboard renders after the setup wizard
- [ ] Log a spend — it lands on today's date, not yesterday's
- [ ] Sign up as a **second** account and confirm it sees none of the first's
      figures. This is the one to actually do: it is the check that row level
      security is on
- [ ] Send a test report from the footer link, and confirm the email arrives
- [ ] `/account` → export both files, then confirm delete works on a throwaway
      account

## Moving your own data in

The local JSON store can be pushed up, but every row needs an owner — the
service-role connection has no `auth.uid()`, so rows written without one are
invisible to every account:

```bash
npm run db:push -- --owner you@example.com --dry-run   # show the plan
npm run db:push -- --owner you@example.com             # apply it
```

`npm run db:reset -- --owner you@example.com` does the reverse for one account.
Both refuse to run without `--owner`, because unscoped they would touch every
tester's rows.

## What is deliberately not here

No error-reporting service. Errors log to the Vercel function log with a digest,
and the error screen shows that digest to the person so their report can be
joined to it. Add Sentry when the volume justifies it.
