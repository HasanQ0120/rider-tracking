-- One row per order, overwritten on every update. This is the Realtime source table:
-- the pipeline only ever carries {lat,lng} + metadata, never map visuals.
create table current_locations (
  order_id uuid primary key references orders(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m double precision not null,
  speed_kmh double precision,
  speed_implausible boolean not null default false,
  session_id text not null,
  recorded_at timestamptz not null default now()
);
alter table current_locations replica identity full;

-- Short dispute-retention window: trimmed to the last ~10 minutes while the
-- order is active, frozen once delivered/cancelled, purged after a few days.
create table location_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m double precision not null,
  speed_kmh double precision,
  recorded_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index idx_lh_order_time on location_history(order_id, recorded_at);

alter table current_locations enable row level security;
alter table location_history enable row level security;

-- Add to the Realtime publication so customer pages can subscribe to Postgres Changes.
alter publication supabase_realtime add table current_locations;
