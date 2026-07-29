-- One profile per account, enforced by the database.
--
-- Nothing stopped a second profile row existing, and two rows is not a cosmetic
-- duplicate: `select *` has no order, and Postgres rewrites an updated row to
-- the end of the heap, so a write to the row a query returned first makes the
-- next query return the other one. Onboarding surfaced it — each step saved its
-- progress to a row the following page did not read, so every Continue landed
-- back on the step you were already on.
--
-- The duplicates come from a race on first run: two server components load the
-- snapshot in parallel, both find no profile, and both insert one. A unique
-- index is the only fix that holds, because the losing insert has to fail.

-- DESTRUCTIVE. Keeps the most recently updated profile per account and deletes
-- the rest. Check what you have first:
--
--   select user_id, count(*) from profile group by user_id having count(*) > 1;
--
delete from profile p
 where p.user_id is not null
   and exists (
     select 1 from profile keep
      where keep.user_id = p.user_id
        and (keep.updated_at, keep.created_at, keep.id)
          > (p.updated_at, p.created_at, p.id)
   );

create unique index if not exists profile_one_per_user
  on profile (user_id)
  where user_id is not null;

comment on index profile_one_per_user is
  'A second profile row for an account makes every unordered read a coin toss. The application picks a row deterministically as well, but that is a safety net, not the rule.';
