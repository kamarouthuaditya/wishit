-- A goal had exactly one ending: reach the target. Real ones end in four ways
-- — you get there, you decide you are finished with it, you stop paying in on a
-- date, or the target date arrives and you move on whether it is full or not
-- (the emergency fund you stop feeding in January when the loan EMI starts).
--
-- None of these touch the balance: money already saved stays saved, it just
-- stops being fed.
--
-- `if not exists` throughout: this migration grew a column after an earlier
-- version had already been applied, and a half-run migration should be safe to
-- run again rather than failing on the column it did manage to add.

alter table goal
  add column if not exists status text not null default 'active',
  add column if not exists contribute_until date,
  add column if not exists stop_at_deadline boolean not null default false;

-- The first cut of this migration attached the check inline, so on a database
-- that already ran it the constraint is there under a generated name.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'goal'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  ) then
    alter table goal add constraint goal_status_check
      check (status in ('active', 'done'));
  end if;
end $$;

comment on column goal.status is
  'active = still being funded. done = finished with by hand; takes no more contributions and drops out of the balance.';

comment on column goal.contribute_until is
  'Last month contributions are made, target reached or not. Null means fund it until it is full.';

comment on column goal.stop_at_deadline is
  'When true, the target date is also the last month funded — no need to keep two dates in step. The earlier of this and contribute_until wins.';
