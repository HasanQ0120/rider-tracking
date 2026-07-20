create extension if not exists pgcrypto;

create table riders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text not null,
  delivery_address text not null,
  delivery_lat double precision,
  delivery_lng double precision,
  status text not null default 'pending'
    check (status in ('pending','assigned','in_transit','arrived','delivered','cancelled')),
  assigned_rider_id uuid references riders(id),
  rider_arrived_at timestamptz,
  proximity_since timestamptz,
  delivery_confirmed_by text check (delivery_confirmed_by in ('human','auto_location')),
  tracking_expired_unresolved boolean not null default false,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index idx_orders_status on orders(status);
create index idx_orders_assigned_rider on orders(assigned_rider_id);
create index idx_orders_flagged on orders(id) where tracking_expired_unresolved;

alter table riders enable row level security;
alter table orders enable row level security;
