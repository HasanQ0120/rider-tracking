-- Per-order pickup override for merchants with multiple branches -- the
-- inbound API (Phase 3) can pass pickup_lat/lng per request instead of
-- always using the tenant's single default_pickup_lat/lng. Null on every
-- order created via ops/merchant dashboards, which have no pickup UI and
-- always resolve the tenant's default at assignment time instead.
alter table orders add column pickup_lat double precision;
alter table orders add column pickup_lng double precision;

-- Narrows an inbound API request to at most one tenant before the (much
-- more expensive) bcrypt compare against that one row's api_key_hash.
create unique index idx_tenants_api_key_prefix on tenants(api_key_prefix) where api_key_prefix is not null;
