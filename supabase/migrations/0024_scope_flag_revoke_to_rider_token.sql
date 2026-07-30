-- flag_order_for_review previously revoked both the rider's and the
-- customer's tracking token (no `type` filter on the UPDATE). Unlike
-- delivered/cancelled, "flagged for review" is not a dead end for the
-- customer -- they should keep live access to see the under-review status
-- and call the rider. Only the rider's token should stop working here.
create or replace function public.flag_order_for_review(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
begin
  update orders
  set status = 'flagged_review', review_flag_reason = p_reason, pending_confirmation_at = null
  where id = p_order_id
    and status not in ('delivered', 'cancelled');

  update tracking_tokens
  set active = false, revoked_at = now(), revoked_reason = 'flagged_review'
  where order_id = p_order_id and type = 'rider' and active;
end;
$function$;
