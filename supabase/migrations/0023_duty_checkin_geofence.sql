-- Per-tenant override for the on-duty check-in geofence radius (meters).
-- Null means "use the platform default" (DEFAULT_DUTY_CHECKIN_RADIUS_M in
-- src/lib/config.ts) rather than baking one global radius in for every
-- merchant -- a mall location and a standalone building reasonably want
-- different tolerances.
alter table tenants add column duty_checkin_radius_m integer;

-- Same column-level grant pattern as migration 0021: the merchant's own
-- authenticated session may only ever update this one additional column
-- on their tenant row, alongside the ones already granted there
-- (auto_assign_enabled, default_pickup_lat/lng/address). RLS's row check
-- (auth_user_id = auth.uid()) already applies from that migration's
-- policy; this only adds the column to what's updatable.
grant update (duty_checkin_radius_m) on tenants to authenticated;
