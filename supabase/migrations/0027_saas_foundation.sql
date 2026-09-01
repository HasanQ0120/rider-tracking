-- SaaS foundation: tenant branding, rider availability/login fields, webhook
-- config, and cron proximity aligned with app PROXIMITY_RADIUS_M (300).

-- Rider availability (referenced by app code since duty-system removal).
alter table riders add column if not exists available boolean not null default true;
alter table riders add column if not exists availability_token text;

update riders
set availability_token = encode(gen_random_bytes(21), 'hex')
where availability_token is null;

create unique index if not exists idx_riders_availability_token
  on riders(availability_token) where availability_token is not null;

-- Rider app login PIN (bcrypt hash; merchant sets on create, rider can change).
alter table riders add column if not exists login_pin_hash text;

-- Duplicate (tenant_id, phone) rows block the login lookup index -- can happen
-- from repeated CSV imports or manual re-adds. Keep the best row per group
-- (active first, then newest); archive the rest by suffixing phone so FK
-- history on assigned orders is preserved.
with ranked as (
  select
    id,
    phone,
    row_number() over (
      partition by tenant_id, phone
      order by active desc, created_at desc
    ) as rn
  from riders
)
update riders r
set
  active = false,
  phone = ranked.phone || '._archived_' || substring(r.id::text, 1, 8)
from ranked
where r.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists idx_riders_tenant_phone on riders(tenant_id, phone);

-- Tenant branding + integration (lite dashboard + customer tracking).
alter table tenants add column if not exists logo_url text;
alter table tenants add column if not exists primary_color text not null default '#1e3a5f';
alter table tenants add column if not exists secondary_color text not null default '#FFD700';
alter table tenants add column if not exists accent_color text not null default '#DC2626';
alter table tenants add column if not exists favicon_url text;
alter table tenants add column if not exists webhook_url text;
alter table tenants add column if not exists webhook_secret text;
alter table tenants add column if not exists contact_email text;
alter table tenants add column if not exists suspended_at timestamptz;

-- Cron proximity auto-deliver: match src/lib/config.ts PROXIMITY_RADIUS_M.
create or replace function check_and_expire_orders()
returns void as $$
declare
  proximity_radius_m constant double precision := 300;
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
