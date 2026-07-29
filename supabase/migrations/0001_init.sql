-- Wishit schema. Single user, no auth, no multi-tenancy.
--
-- RLS is ON with no policies on every table. That is deliberate: it blocks the
-- anon key outright, so nothing here is reachable from the browser. All access
-- goes through Next.js server actions using the service role key, which
-- bypasses RLS. Never expose SUPABASE_SERVICE_ROLE_KEY to the client.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profile ---
create table profile (
  id                   uuid primary key default gen_random_uuid(),
  name                 text        not null default 'Me',
  currency             text        not null default 'INR',
  fiscal_month_start   int         not null default 1,
  pay_date             int         not null default 1,
  -- Balance sheet
  liquid_corpus        numeric(14,2) not null default 0,
  emergency_floor      numeric(14,2) not null default 0,
  -- Engine settings. Both default to 0: conservative and easy to reason about.
  annual_return_pct    numeric(6,3)  not null default 0,
  annual_inflation_pct numeric(6,3)  not null default 0,
  bonus_mode           text          not null default 'lump'
                       check (bonus_mode in ('lump', 'amortised')),
  allocation_mode      text          not null default 'waterfall'
                       check (allocation_mode in ('waterfall', 'fixed', 'proportional')),
  horizon_months       int           not null default 36,
  setup_complete       boolean       not null default false,
  created_at           timestamptz   not null default now(),
  updated_at           timestamptz   not null default now()
);

-- ----------------------------------------------------------------- income ---
create table income (
  id             uuid primary key default gen_random_uuid(),
  type           text not null check (type in ('salary', 'bonus', 'other')),
  label          text not null default '',
  amount         numeric(14,2) not null,
  -- 'monthly' | 'annual'. Bonuses are annual and land in bonus_month.
  frequency      text not null default 'monthly'
                 check (frequency in ('monthly', 'annual')),
  bonus_month    int,
  effective_from date not null default current_date,
  effective_to   date,
  created_at     timestamptz not null default now()
);

-- --------------------------------------------------------------- expenses ---
create table expense_item (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  category       text not null,
  amount         numeric(14,2) not null,
  -- fixed  -> rent, home contribution, insurance, internet, subscriptions
  -- variable -> food, petrol, travel, shopping, medical (budgeted)
  -- investment -> SIP, retirement
  type           text not null check (type in ('fixed', 'variable', 'investment')),
  -- Variable lines are budgets; projections use the budget, never the actuals.
  is_budget      boolean not null default false,
  -- A rent hike in month 5 must show up correctly in a 12-month projection.
  effective_from date not null default current_date,
  effective_to   date,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create index expense_item_active_idx on expense_item (is_active, type);

-- One-off spends are recorded here and never extrapolated across the horizon.
create table transaction (
  id         uuid primary key default gen_random_uuid(),
  date       date not null,
  amount     numeric(14,2) not null,
  category   text not null,
  note       text,
  source     text not null default 'manual' check (source in ('manual', 'import')),
  is_one_off boolean not null default false,
  created_at timestamptz not null default now()
);

create index transaction_date_idx on transaction (date desc);

-- ------------------------------------------------------------------ loans ---
create table loan (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  type           text not null default 'other'
                 check (type in ('education', 'personal', 'home', 'vehicle',
                                 'consumer-emi', 'no-cost-emi', 'other')),
  principal      numeric(14,2) not null,
  outstanding    numeric(14,2) not null,
  annual_rate_pct numeric(6,3) not null default 0,
  emi            numeric(14,2) not null,
  tenure_months  int not null,
  start_date     date not null,
  due_day        int not null default 1,
  is_no_cost     boolean not null default false,
  -- No-cost EMI true-cost inputs. "No cost" is never zero cost.
  cash_discount  numeric(14,2) not null default 0,
  processing_fee numeric(14,2) not null default 0,
  notional_rate_pct numeric(6,3) not null default 15,
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------ credit card ---
create table credit_card (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  credit_limit  numeric(14,2) not null,
  statement_day int not null default 1,
  due_day       int not null default 20,
  current_bill  numeric(14,2) not null default 0,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------------ goals ---
create table goal (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  target          numeric(14,2) not null,
  current_amount  numeric(14,2) not null default 0,
  deadline        date,
  -- Load-bearing: when surplus is short, this decides who gets starved.
  priority        int not null default 1,
  expected_return_pct numeric(6,3) not null default 0,
  is_protected    boolean not null default false,
  fixed_contribution numeric(14,2),
  weight          numeric(6,2) not null default 1,
  created_at      timestamptz not null default now()
);

create index goal_priority_idx on goal (priority);

create table goal_contribution (
  id      uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goal(id) on delete cascade,
  month   date not null,
  amount  numeric(14,2) not null,
  unique (goal_id, month)
);

-- --------------------------------------------------------------- wishlist ---
create table wishlist_item (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text not null default 'general',
  price         numeric(14,2) not null,
  priority      int not null default 3,
  target_date   date,
  reason        text,
  purchase_mode text not null default 'cash'
                check (purchase_mode in ('cash', 'emi', 'down-payment-emi', 'save-then-buy')),
  emi_amount    numeric(14,2),
  emi_tenure    int,
  down_payment  numeric(14,2),
  monthly_saving numeric(14,2),
  annual_rate_pct numeric(6,3) not null default 0,
  is_no_cost    boolean not null default false,
  -- Only 'committed' items subtract from surplus in the baseline. 'planned'
  -- items are simulation-only. This is what keeps the dashboard trustworthy.
  status        text not null default 'idea'
                check (status in ('idea', 'planned', 'committed', 'purchased', 'dropped')),
  purchase_month int,
  created_at    timestamptz not null default now()
);

create index wishlist_status_idx on wishlist_item (status);

-- -------------------------------------------------------------- scenarios ---
create table scenario (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  item_ids   uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table simulation_run (
  id          uuid primary key default gen_random_uuid(),
  scenario_id uuid references scenario(id) on delete cascade,
  horizon     int not null,
  results_json jsonb not null,
  created_at  timestamptz not null default now()
);

-- --------------------------------------------------------------- snapshot ---
-- Written on the 1st of every month. Trends read history and never recompute
-- it, so past charts do not silently rewrite themselves when an expense is
-- edited after the fact.
create table monthly_snapshot (
  id           uuid primary key default gen_random_uuid(),
  month        date not null unique,
  corpus       numeric(14,2) not null,
  net_worth    numeric(14,2) not null,
  surplus      numeric(14,2) not null,
  savings_rate numeric(6,4) not null,
  total_inflow numeric(14,2) not null,
  total_outflow numeric(14,2) not null,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------- career ---
-- Context layer only. current_salary and expected_bonus are the sole fields
-- that feed the financial model; the rest is a personal log.
create table career_entry (
  id         uuid primary key default gen_random_uuid(),
  date       date not null default current_date,
  kind       text not null default 'note'
             check (kind in ('note', 'skill', 'project', 'raise', 'role-change')),
  title      text not null,
  body       text,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------------- rls ---
alter table profile           enable row level security;
alter table income            enable row level security;
alter table expense_item      enable row level security;
alter table transaction       enable row level security;
alter table loan              enable row level security;
alter table credit_card       enable row level security;
alter table goal              enable row level security;
alter table goal_contribution enable row level security;
alter table wishlist_item     enable row level security;
alter table scenario          enable row level security;
alter table simulation_run    enable row level security;
alter table monthly_snapshot  enable row level security;
alter table career_entry      enable row level security;

-- Exactly one profile row.
insert into profile (name) values ('Me');
