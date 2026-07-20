-- Outbox for notifications triggered from pure-SQL contexts (the cron reissue
-- path) that have no live Next.js request to call sendNotification() from
-- directly. A Next.js route polls this table and sends through the same
-- notification abstraction used by every other call site.
create table pending_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  to_phone text not null,
  message text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index idx_pending_notifications_unsent on pending_notifications(created_at) where sent_at is null;

alter table pending_notifications enable row level security;

-- Ops staff allowlist: a Supabase Auth user must have a row here to use
-- /ops/*. Auth accounts alone are not sufficient -- rows are provisioned
-- manually (service role), there is no self-service ops signup.
create table ops_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table ops_staff enable row level security;
