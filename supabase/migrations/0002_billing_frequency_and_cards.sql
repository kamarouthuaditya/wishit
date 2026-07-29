-- Two things the first cut got wrong.
--
-- 1. Not everything is monthly. A gym paid every six months is one payment of
--    ₹9,000, not ₹1,500 a month. `amount` is now the amount billed each time,
--    and `frequency_months` says how often. The simulation charges it in the
--    month it is actually due; the planner divides it out for budgeting.
--
-- 2. Spending put on a credit card does not leave your bank account that month
--    — the card bill does, later. Tagging the line to a card lets the app show
--    what is on plastic without counting the same rupee twice.

alter table expense_item
  add column frequency_months int not null default 1
    check (frequency_months in (1, 3, 6, 12)),
  add column paid_by_card_id uuid references credit_card(id) on delete set null;

create index expense_item_card_idx on expense_item (paid_by_card_id);

comment on column expense_item.amount is
  'Amount billed each time, not per month. Divide by frequency_months for the monthly equivalent.';
