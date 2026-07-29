-- Reverses 0003. Pointing a savings line at a goal turned out to be one concept
-- too many: a goal now carries its own monthly contribution, set on the goal
-- itself, and a savings line is simply a savings line. The link only existed to
-- stop the two being counted twice, and there is no longer anything to double.

drop index if exists expense_item_goal_idx;

alter table expense_item
  drop column if exists funds_goal_id;
