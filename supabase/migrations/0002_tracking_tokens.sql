create table tracking_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  order_id uuid not null references orders(id) on delete cascade,
  type text not null check (type in ('rider','customer')),
  rider_id uuid references riders(id),
  active boolean not null default true,
  expires_at timestamptz not null,
  pin_fail_count int not null default 0,
  pin_locked_until timestamptz,
  last_resend_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text check (revoked_reason in
    ('completed_manual','completed_auto_location','time_expired','reassigned','cancelled','device_reset')),
  -- transient plaintext PIN, set only by the cron reissue path so the notification
  -- queue can send it once, then cleared immediately after enqueueing
  pending_plaintext_pin text,
  created_at timestamptz not null default now()
);

-- DB-level guarantee: at most one active rider token and one active customer
-- token per order, independent of application logic correctness.
create unique index one_active_rider_token_per_order
  on tracking_tokens(order_id) where type = 'rider' and active;
create unique index one_active_customer_token_per_order
  on tracking_tokens(order_id) where type = 'customer' and active;

create index idx_tt_order on tracking_tokens(order_id);
create index idx_tt_token on tracking_tokens(token);

create table pin_codes (
  id uuid primary key default gen_random_uuid(),
  rider_token_id uuid unique not null references tracking_tokens(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  pin_hash text not null,
  created_at timestamptz not null default now()
);

create table pin_attempts (
  id uuid primary key default gen_random_uuid(),
  rider_token_id uuid not null references tracking_tokens(id) on delete cascade,
  success boolean not null,
  ip text,
  attempted_at timestamptz not null default now()
);
create index idx_pin_attempts_token on pin_attempts(rider_token_id, attempted_at desc);

create table device_locks (
  rider_token_id uuid primary key references tracking_tokens(id) on delete cascade,
  device_key text not null,
  locked_at timestamptz not null default now()
);

create table tracking_sessions (
  id uuid primary key default gen_random_uuid(),
  rider_token_id uuid not null references tracking_tokens(id) on delete cascade,
  session_id text not null unique,
  is_active boolean not null default true,
  pin_verified_at timestamptz not null default now(),
  superseded_at timestamptz
);
create index idx_sessions_rider_token_active on tracking_sessions(rider_token_id) where is_active;

alter table tracking_tokens enable row level security;
alter table pin_codes enable row level security;
alter table pin_attempts enable row level security;
alter table device_locks enable row level security;
alter table tracking_sessions enable row level security;
