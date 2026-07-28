-- The default Supabase "grant all on all tables to authenticated" already
-- covers UPDATE on every column of tenants. An RLS policy alone only
-- restricts which ROW a merchant can touch, not which COLUMNS -- without
-- this revoke+column-grant, a merchant could PATCH their own tenants row
-- directly via the REST API and rewrite merchant_id, active, or
-- api_key_hash, none of which they're supposed to be able to change
-- themselves.
revoke update on tenants from authenticated;
grant update (auto_assign_enabled, default_pickup_lat, default_pickup_lng, default_pickup_address)
  on tenants to authenticated;

create policy "merchant updates own tenant row" on tenants for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());
