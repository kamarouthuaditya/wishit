-- A card bill is a due, like an EMI: money already spent that leaves your
-- account on a date you did not choose. Until now `credit_card.current_bill`
-- was a number you typed, unrelated to anything you had actually recorded.
--
-- Tagging a logged spend to the card is what makes the bill real. The bill is
-- not a new expense — it is the same money moving later — so nothing here is
-- added to the budget a second time. It is a timing fact, and it is shown as
-- one.

alter table transaction
  add column if not exists paid_by_card_id uuid
    references credit_card(id) on delete set null;

create index if not exists transaction_card_idx on transaction (paid_by_card_id);

comment on column transaction.paid_by_card_id is
  'When set, this spend went on that card: it leaves your bank when the statement falls due, not on the day it was spent.';
