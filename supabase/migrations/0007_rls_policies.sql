-- Every table defaults to RLS-enabled with NO policies, i.e. total deny for
-- anon/authenticated -- all reads/writes go through Next.js Route Handlers
-- using the service role, which has already validated the relevant token.
-- The one exception is current_locations, which the customer's browser
-- subscribes to directly via Supabase Realtime using a short-lived
-- app-issued JWT (see lib/supabase/customerJwt.ts) carrying an `order_id`
-- claim. Re-checked on every connection because the JWT is short-lived and
-- re-minted only if the customer token is still active + unexpired.
create policy "customer reads own order location"
  on current_locations for select
  to authenticated, anon
  using ((auth.jwt() ->> 'order_id') = order_id::text);

-- ops_staff: a logged-in Supabase Auth user may check their own membership
-- (used by middleware to gate /ops/*) but never anyone else's.
create policy "ops user reads own membership"
  on ops_staff for select
  to authenticated
  using (user_id = auth.uid());
