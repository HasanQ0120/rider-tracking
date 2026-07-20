-- The customer page also needs to learn about status changes (delivered,
-- cancelled, arrived, tracking_expired_unresolved) that happen on the
-- `orders` row itself, not just location updates -- otherwise "delivered"
-- would only ever be discovered on the next JWT-refresh poll.
create policy "customer reads own order"
  on orders for select
  to authenticated, anon
  using ((auth.jwt() ->> 'order_id') = id::text);

alter publication supabase_realtime add table orders;
