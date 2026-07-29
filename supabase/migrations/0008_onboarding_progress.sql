-- Onboarding is a sequence now, not one long form, so the profile has to
-- remember how far someone got. `setup_complete` cannot do that job: it is a
-- single flag that is only true at the very end, which means an interrupted
-- sign-up came back to a blank first screen with the answers already in the
-- database.
--
-- The value is a count of finished steps, not the name of the current one:
-- steps get reordered and renamed, and a stored slug would rot the moment they
-- did. 0 means nothing finished; the app clamps anything past the end.

alter table profile
  add column if not exists onboarding_step int not null default 0;

-- Anyone already using the app has finished, whatever the counter says.
update profile set onboarding_step = 99 where setup_complete;

comment on column profile.onboarding_step is
  'How many onboarding steps are finished. Lets an interrupted sign-up resume where it stopped rather than starting over.';
