-- Fix mutable search_path (WARN: function_search_path_mutable) on every function.
alter function haversine_m(double precision, double precision, double precision, double precision) set search_path = public, pg_temp;
alter function generate_token(int) set search_path = public, pg_temp;
alter function generate_pin() set search_path = public, pg_temp;
alter function trim_location_history() set search_path = public, pg_temp;
alter function mark_order_delivered(uuid, text) set search_path = public, pg_temp;
alter function cancel_order(uuid) set search_path = public, pg_temp;
alter function reissue_rider_token(uuid, uuid, text) set search_path = public, pg_temp;
alter function check_and_expire_orders() set search_path = public, pg_temp;
alter function purge_old_location_history() set search_path = public, pg_temp;

-- These SECURITY DEFINER functions bypass RLS by design (they're the trusted
-- write path called from service-role Next.js routes / pg_cron). Without
-- revoking the default PUBLIC execute grant, anon/authenticated could call
-- them directly via PostgREST RPC (e.g. POST /rest/v1/rpc/cancel_order) and
-- skip every authorization check the Route Handlers perform. Only the
-- postgres owner and service_role may call them.
revoke execute on function mark_order_delivered(uuid, text) from public, anon, authenticated;
revoke execute on function cancel_order(uuid) from public, anon, authenticated;
revoke execute on function reissue_rider_token(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function check_and_expire_orders() from public, anon, authenticated;
revoke execute on function purge_old_location_history() from public, anon, authenticated;
revoke execute on function trim_location_history() from public, anon, authenticated;

grant execute on function mark_order_delivered(uuid, text) to service_role;
grant execute on function cancel_order(uuid) to service_role;
grant execute on function reissue_rider_token(uuid, uuid, text) to service_role;
grant execute on function check_and_expire_orders() to service_role;
grant execute on function purge_old_location_history() to service_role;
