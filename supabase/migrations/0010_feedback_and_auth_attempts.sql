-- Two tables the app needs before strangers use it.
--
-- `feedback` is how a tester tells you something is wrong without leaving the
-- app or knowing your email. It is deliberately reachable while signed out:
-- the report worth the most is the one from somebody who cannot get in.
--
-- `auth_attempt` is the rate limiter's memory. Sign-up and password-reset both
-- mint a code and send an email over one Gmail account; without a ceiling, one
-- script can exhaust the day's quota and every real tester is locked out.

-- ---------------------------------------------------------------- feedback ---

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  -- 'issue' or 'suggestion'. A check rather than an enum: adding a third kind
  -- should not need a type migration.
  kind text not null default 'issue' check (kind in ('issue', 'suggestion')),
  message text not null check (length(trim(message)) > 0),
  -- Where they were and, if this came from an error screen, which error. The
  -- digest is what Next prints in the server log, so a report joins to a stack.
  page text,
  error_digest text,
  user_agent text,
  -- Signed-out reports have no account to attach, so the address is taken from
  -- the form. Nullable on purpose.
  contact_email text,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_idx on feedback (created_at desc);
create index if not exists feedback_user_idx on feedback (user_id);

alter table feedback enable row level security;

-- Signed-in people may file their own and read their own back. Everything else,
-- including every signed-out report, is written by the server with the service
-- role, which RLS does not apply to.
drop policy if exists feedback_own_rows on feedback;
create policy feedback_own_rows on feedback
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ------------------------------------------------------------ auth_attempt ---

create table if not exists auth_attempt (
  id uuid primary key default gen_random_uuid(),
  -- The address being acted on, lowercased. Not a user id: the whole point is
  -- to limit attempts against addresses that may not have accounts.
  subject text not null,
  kind text not null check (kind in ('signup', 'recovery', 'signin')),
  created_at timestamptz not null default now()
);

create index if not exists auth_attempt_lookup_idx
  on auth_attempt (subject, kind, created_at desc);

alter table auth_attempt enable row level security;
-- No policies at all: only the service role touches this, and a rate limiter
-- that the rate-limited party can read or delete is not a rate limiter.

comment on table auth_attempt is
  'Rate-limiter memory for code minting. Service role only; rows older than a day can be deleted freely.';
