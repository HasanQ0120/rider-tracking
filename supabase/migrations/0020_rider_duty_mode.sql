-- Persistent per-rider "on duty" link, separate from per-order tracking --
-- lets an idle rider (between deliveries) report a location that
-- auto-assignment can actually see.
alter table riders add column duty_token text unique;

-- One-time backfill for existing riders; new riders get an app-generated
-- nanoid token (see src/lib/tokens.ts) at creation time instead.
update riders set duty_token = gen_random_uuid()::text where duty_token is null;

alter table riders alter column duty_token set not null;

create table rider_duty_locations (
  rider_id uuid primary key references riders(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  recorded_at timestamptz not null,
  session_id text not null
);

alter table rider_duty_locations enable row level security;

-- Add pickup-location fields' index-free lookup path isn't needed (single
-- row per tenant), but the duty_token lookup is hit on every location ping.
create index idx_riders_duty_token on riders(duty_token);
