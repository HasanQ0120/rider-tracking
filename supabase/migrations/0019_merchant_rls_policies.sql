-- The real database-level tenant-isolation guarantee: these are exercised
-- by the merchant dashboard's request-scoped, tenant-authenticated
-- Supabase client (src/lib/merchant/authGuard.ts), never by the
-- service-role client ops/rider/customer routes use. tenant_id lives in
-- Supabase Auth app_metadata, settable only via the service-role admin
-- API at provisioning time -- a merchant can never forge a different
-- tenant_id claim for their own session.
--
-- Scoped to select+insert only for this phase -- the merchant dashboard
-- doesn't yet do direct row updates (assign/cancel flows are dedicated
-- API routes with their own explicit tenant checks, mirroring how the ops
-- equivalents already work, not raw client-side updates through RLS).

create policy "merchant selects own orders"
  on orders for select
  to authenticated
  using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

create policy "merchant inserts own orders"
  on orders for insert
  to authenticated
  with check (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

create policy "merchant selects own riders"
  on riders for select
  to authenticated
  using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

create policy "merchant inserts own riders"
  on riders for insert
  to authenticated
  with check (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- A merchant may read (never write) their own tenant row -- used by the
-- dashboard to show their name/settings/auto_assign_enabled toggle state.
create policy "merchant reads own tenant row"
  on tenants for select
  to authenticated
  using (auth_user_id = auth.uid());
