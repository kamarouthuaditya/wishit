-- Wishit becomes multi-user.
--
-- Until now every table had RLS enabled with no policies at all: nothing could
-- read anything, and the app got in by using the service-role key, which
-- bypasses RLS entirely. That works for one person and is indefensible for two.
--
-- Now every row belongs to an account, the app connects as the signed-in user,
-- and Postgres — not application code — decides what that user can see. There
-- is no `where user_id = ...` in the app to forget one day.

-- ------------------------------------------------------------------ column ---
-- `default auth.uid()` means inserts do not have to mention user_id at all, so
-- the application code did not need to learn about it.

do $$
declare
  t text;
begin
  foreach t in array array[
    'profile', 'income', 'expense_item', 'transaction', 'loan', 'credit_card',
    'goal', 'goal_contribution', 'wishlist_item', 'scenario', 'simulation_run',
    'monthly_snapshot', 'career_entry'
  ]
  loop
    execute format(
      'alter table %I add column if not exists user_id uuid
         default auth.uid() references auth.users(id) on delete cascade', t);
    execute format('create index if not exists %I on %I (user_id)', t || '_user_idx', t);
  end loop;
end $$;

-- -------------------------------------------------------------------- claim ---
-- The rows that existed before accounts did belong to one person. Attach them
-- to that account if it is already there; if it is not, this is a no-op and the
-- statement can be run again after signing up.

do $$
declare
  owner_id uuid;
  t text;
begin
  select id into owner_id from auth.users where email = 'aditya@onshorelabs.co.in';

  if owner_id is null then
    raise notice 'No account for aditya@onshorelabs.co.in yet — sign up, then run this migration again to claim the existing rows.';
    return;
  end if;

  foreach t in array array[
    'profile', 'income', 'expense_item', 'transaction', 'loan', 'credit_card',
    'goal', 'goal_contribution', 'wishlist_item', 'scenario', 'simulation_run',
    'monthly_snapshot', 'career_entry'
  ]
  loop
    execute format('update %I set user_id = $1 where user_id is null', t)
      using owner_id;
  end loop;
end $$;

-- ------------------------------------------------------------------ policies ---
-- One policy per table, covering every verb: you touch your own rows, nothing
-- else. `with check` on writes stops a row being handed to someone else.

do $$
declare
  t text;
begin
  foreach t in array array[
    'profile', 'income', 'expense_item', 'transaction', 'loan', 'credit_card',
    'goal', 'goal_contribution', 'wishlist_item', 'scenario', 'simulation_run',
    'monthly_snapshot', 'career_entry'
  ]
  loop
    execute format('drop policy if exists %I on %I', t || '_own_rows', t);
    execute format(
      'create policy %I on %I
         for all
         to authenticated
         using (user_id = auth.uid())
         with check (user_id = auth.uid())', t || '_own_rows', t);
  end loop;
end $$;

comment on column profile.user_id is
  'The account this row belongs to. Set automatically from the session; RLS refuses anything else.';
