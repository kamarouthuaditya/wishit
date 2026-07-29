-- The twelve-character codes we email, and nothing that can redeem one.
--
-- Supabase mints a numeric OTP and that is still the only thing that creates a
-- session, but it is never emailed. It is sealed here under a key derived from
-- a code we generated, and that code is emailed instead — which is how the
-- product gets a GitHub-shaped `A1B2-C3D4-E5F6` out of a system that only ever
-- produces digits.
--
-- Nothing in this table can verify anybody. The code is not stored, hashed or
-- otherwise: the only proof that a typed code is right is that it derives a key
-- whose GCM tag checks out. A dump of these rows is ciphertext and salts.

create table if not exists auth_code (
  id uuid primary key default gen_random_uuid(),
  -- The address the code was sent to, lowercased. Not a user id: a recovery
  -- code is issued before we will admit whether an account exists.
  subject text not null,
  purpose text not null check (purpose in ('signup', 'recovery')),

  -- scrypt salt for the key derivation, and the AES-256-GCM parameters. Hex,
  -- not bytea, so that reading a row in the dashboard does not mean decoding
  -- an escape format by eye.
  salt text not null,
  iv text not null,
  sealed_otp text not null,
  auth_tag text not null,

  -- Wrong guesses. The app burns the code at six, so this never climbs far.
  attempts integer not null default 0,

  expires_at timestamptz not null,
  -- Set on success, on the sixth wrong guess, and on every outstanding code for
  -- an address when a new one is issued. A row with this set is dead.
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

-- The redeem path's only query: newest live code for an address.
create index if not exists auth_code_lookup_idx
  on auth_code (subject, created_at desc)
  where consumed_at is null;

alter table auth_code enable row level security;
-- No policies, deliberately. Only the service role touches this table, and a
-- signed-out stranger is exactly who is redeeming a code — anything reachable
-- with the publishable key here would hand out the ciphertext and the salt to
-- the person attacking it.

comment on table auth_code is
  'Emailed sign-in codes. Service role only. Rows past expires_at can be deleted freely.';
