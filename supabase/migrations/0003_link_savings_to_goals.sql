-- A fixed deposit that *is* your emergency fund was being counted twice: once
-- as a savings outflow that reduced surplus, and again as a goal competing for
-- whatever surplus was left.
--
-- Linking the line to the goal it funds fixes it. A linked line stops being an
-- outflow and becomes that goal's monthly contribution — the money is still
-- committed, but it lands somewhere instead of vanishing.

alter table expense_item
  add column funds_goal_id uuid references goal(id) on delete set null;

create index expense_item_goal_idx on expense_item (funds_goal_id);

comment on column expense_item.funds_goal_id is
  'When set, this savings line funds that goal. It is a goal contribution, not a separate expense — never subtracted twice.';
