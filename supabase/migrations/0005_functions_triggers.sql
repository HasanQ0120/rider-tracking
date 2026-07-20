create or replace function haversine_m(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision as $$
declare
  r constant double precision := 6371000;
  dlat double precision;
  dlng double precision;
  a double precision;
begin
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  a := sin(dlat / 2) ^ 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ^ 2;
  return r * 2 * atan2(sqrt(a), sqrt(1 - a));
end;
$$ language plpgsql immutable;

create or replace function generate_token(len int default 24)
returns text as $$
  select encode(gen_random_bytes(len), 'hex');
$$ language sql volatile;

create or replace function generate_pin()
returns text as $$
  select lpad((floor(random() * 1000000))::int::text, 6, '0');
$$ language sql volatile;

-- While the parent order is still open, keep only the last 10 minutes of
-- history per order. Once delivered/cancelled, trimming stops so the final
-- ~10 minutes before completion freezes in place for the dispute window
-- (nightly purge job removes it a few days after delivery, see 0006).
create or replace function trim_location_history() returns trigger as $$
declare
  v_status text;
begin
  select status into v_status from orders where id = new.order_id;
  if v_status not in ('delivered', 'cancelled') then
    delete from location_history
    where order_id = new.order_id
      and recorded_at < now() - interval '10 minutes';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_trim_location_history
  after insert on location_history
  for each row execute function trim_location_history();

-- Single, shared completion path for manual taps and auto-location expiry.
-- Revokes both tokens immediately, so token expiry is exact at the moment
-- of completion rather than lagging behind a cleanup job.
create or replace function mark_order_delivered(p_order_id uuid, p_confirmed_by text)
returns void as $$
begin
  update orders
  set status = 'delivered',
      delivered_at = now(),
      delivery_confirmed_by = p_confirmed_by,
      proximity_since = null
  where id = p_order_id
    and status not in ('delivered', 'cancelled');

  update tracking_tokens
  set active = false,
      revoked_at = now(),
      revoked_reason = case when p_confirmed_by = 'auto_location'
        then 'completed_auto_location' else 'completed_manual' end
  where order_id = p_order_id and active;
end;
$$ language plpgsql security definer;

create or replace function cancel_order(p_order_id uuid)
returns void as $$
begin
  update orders set status = 'cancelled' where id = p_order_id;

  update tracking_tokens
  set active = false, revoked_at = now(), revoked_reason = 'cancelled'
  where order_id = p_order_id and active;
end;
$$ language plpgsql security definer;

-- Reissues a rider token+PIN to the SAME rider (used by both explicit
-- reassignment and the time-based-expiry-reissue fallback). Enqueues a
-- notification instead of sending directly, since this can be called from
-- a pure-SQL cron context with no live HTTP request to send from.
create or replace function reissue_rider_token(p_order_id uuid, p_rider_id uuid, p_reason text)
returns uuid as $$
declare
  v_token_id uuid;
  v_token text;
  v_pin text;
  v_rider_phone text;
  v_expires interval := interval '4 hours';
begin
  if p_reason = 'reassigned' then
    update tracking_tokens
    set active = false, revoked_at = now(), revoked_reason = 'reassigned'
    where order_id = p_order_id and type = 'rider' and active;
  end if;

  v_token := generate_token(24);
  v_pin := generate_pin();

  insert into tracking_tokens (token, order_id, type, rider_id, expires_at, pending_plaintext_pin)
  values (v_token, p_order_id, 'rider', p_rider_id, now() + v_expires, v_pin)
  returning id into v_token_id;

  insert into pin_codes (rider_token_id, order_id, pin_hash)
  values (v_token_id, p_order_id, crypt(v_pin, gen_salt('bf')));

  select phone into v_rider_phone from riders where id = p_rider_id;

  insert into pending_notifications (order_id, to_phone, message, reason)
  values
    (p_order_id, v_rider_phone, 'link:' || v_token, 'rider_link_' || p_reason),
    (p_order_id, v_rider_phone, 'pin:' || v_pin, 'rider_pin_' || p_reason);

  update tracking_tokens set pending_plaintext_pin = null where id = v_token_id;
  update orders set assigned_rider_id = p_rider_id where id = p_order_id;

  return v_token_id;
end;
$$ language plpgsql security definer;

-- Runs on a schedule (see 0006). Handles both auto-expiry mechanisms:
--  (a) sustained proximity to the delivery address -> auto-confirm delivered
--  (b) rider token time budget elapsed -> expire link only, flag ops, reissue
create or replace function check_and_expire_orders()
returns void as $$
declare
  proximity_radius_m constant double precision := 60;
  proximity_sustain_seconds constant int := 90;
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
end;
$$ language plpgsql security definer;

-- Nightly purge of dispute-window history well past its retention period.
create or replace function purge_old_location_history()
returns void as $$
begin
  delete from location_history lh
  using orders o
  where o.id = lh.order_id
    and o.status = 'delivered'
    and o.delivered_at < now() - interval '3 days';
end;
$$ language plpgsql security definer;
