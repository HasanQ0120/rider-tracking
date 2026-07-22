-- Widen allowed order statuses for the new rider-initiated delivery
-- confirmation flow.
alter table orders drop constraint orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('pending','assigned','in_transit','arrived','delivered','cancelled','pending_confirmation','flagged_review'));

-- Distinguishes how a rider-initiated confirmation actually resolved --
-- a genuine customer "yes" vs. an unanswered 30-minute timeout -- for
-- audit/dispute purposes, separate from the pre-existing 'human'
-- (customer's own independent Complete button) and 'auto_location'
-- (sustained-proximity auto-detect) values.
alter table orders drop constraint orders_delivery_confirmed_by_check;
alter table orders add constraint orders_delivery_confirmed_by_check
  check (delivery_confirmed_by in ('human','auto_location','customer_confirmed','customer_timeout'));

alter table orders add column pending_confirmation_at timestamptz;
alter table orders add column review_flag_reason text
  check (review_flag_reason in ('far_from_address','customer_rejected'));

alter table tracking_tokens drop constraint tracking_tokens_revoked_reason_check;
alter table tracking_tokens add constraint tracking_tokens_revoked_reason_check
  check (revoked_reason in ('completed_manual','completed_auto_location','time_expired','reassigned','cancelled','device_reset','flagged_review'));

-- Rider tapped Mark Complete within the proximity radius: enters a
-- holding state waiting for the customer's Yes/No response. Tokens are
-- NOT revoked here -- only on final resolution (delivered or flagged) --
-- so ops can still reach the rider's tracking link if a dispute needs it.
create or replace function set_pending_confirmation(p_order_id uuid)
returns void as $$
begin
  update orders
  set status = 'pending_confirmation', pending_confirmation_at = now()
  where id = p_order_id
    and status not in ('delivered', 'cancelled', 'flagged_review');
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Terminal review state: rider tapped Mark Complete too far from the
-- delivery address, or the customer explicitly said they didn't receive
-- it. Both tokens are revoked immediately, same as a normal delivery --
-- resuming tracking on a flagged order requires ops to re-engage (e.g.
-- reassign), same as any other closed order.
create or replace function flag_order_for_review(p_order_id uuid, p_reason text)
returns void as $$
begin
  update orders
  set status = 'flagged_review', review_flag_reason = p_reason, pending_confirmation_at = null
  where id = p_order_id
    and status not in ('delivered', 'cancelled');

  update tracking_tokens
  set active = false, revoked_at = now(), revoked_reason = 'flagged_review'
  where order_id = p_order_id and active;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke execute on function set_pending_confirmation(uuid) from public, anon, authenticated;
revoke execute on function flag_order_for_review(uuid, text) from public, anon, authenticated;
grant execute on function set_pending_confirmation(uuid) to service_role;
grant execute on function flag_order_for_review(uuid, text) to service_role;

-- Extend the existing cron function: bump proximity_radius_m to 100
-- (matching the app-wide PROXIMITY_RADIUS_M constant), and add a third
-- pass auto-resolving any order that's been waiting on a customer's
-- Yes/No response for more than 30 minutes -- recorded as a timeout,
-- never as a genuine confirmation.
create or replace function check_and_expire_orders()
returns void as $$
declare
  proximity_radius_m constant double precision := 100;
  proximity_sustain_seconds constant int := 90;
  pending_confirmation_timeout_minutes constant int := 30;
  rec record;
  dist double precision;
begin
  for rec in
    select o.id, o.delivery_lat, o.delivery_lng, o.proximity_since, cl.lat, cl.lng
    from orders o
    join current_locations cl on cl.order_id = o.id
    where o.status in ('assigned', 'in_transit', 'arrived')
      and o.delivery_lat is not null and o.delivery_lng is not null
  loop
    dist := haversine_m(rec.delivery_lat, rec.delivery_lng, rec.lat, rec.lng);
    if dist <= proximity_radius_m then
      if rec.proximity_since is null then
        update orders set proximity_since = now() where id = rec.id;
      elsif now() - rec.proximity_since >= (proximity_sustain_seconds || ' seconds')::interval then
        perform mark_order_delivered(rec.id, 'auto_location');
      end if;
    else
      if rec.proximity_since is not null then
        update orders set proximity_since = null where id = rec.id;
      end if;
    end if;
  end loop;

  for rec in
    select tt.id as token_id, tt.order_id, tt.rider_id, o.status
    from tracking_tokens tt
    join orders o on o.id = tt.order_id
    where tt.type = 'rider' and tt.active and tt.expires_at <= now()
  loop
    update tracking_tokens
    set active = false, revoked_at = now(), revoked_reason = 'time_expired'
    where id = rec.token_id;

    if rec.status not in ('delivered', 'cancelled') then
      update orders set tracking_expired_unresolved = true where id = rec.order_id;
      perform reissue_rider_token(rec.order_id, rec.rider_id, 'time_expired_reissue');
    end if;
  end loop;

  for rec in
    select o.id
    from orders o
    where o.status = 'pending_confirmation'
      and o.pending_confirmation_at is not null
      and now() - o.pending_confirmation_at >= (pending_confirmation_timeout_minutes || ' minutes')::interval
  loop
    perform mark_order_delivered(rec.id, 'customer_timeout');
  end loop;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
