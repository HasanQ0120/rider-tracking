-- Multi-tenant foundation. merchant_id is the fixed, non-changeable login
-- identity a merchant types in at /merchant/login -- distinct from `id`
-- (the internal FK target) so it can be a short, human-chosen string
-- without ever needing to double as a primary key.
create table tenants (
  id uuid primary key default gen_random_uuid(),
  merchant_id text not null unique,
  name text not null,
  -- Supabase Auth identity used for merchant dashboard login (synthetic
  -- email under the hood -- see src/lib/merchant/authGuard.ts). Nullable
  -- until provisioned.
  auth_user_id uuid unique references auth.users(id),
  -- Only ever a bcrypt hash, same pattern as pin_codes.pin_hash -- the
  -- plaintext key is shown to the merchant exactly once, at issuance.
  api_key_hash text,
  api_key_prefix text,
  auto_assign_enabled boolean not null default false,
  default_pickup_lat double precision,
  default_pickup_lng double precision,
  default_pickup_address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table tenants enable row level security;
-- No policies yet: tenants is provisioned/read by service role (ops
-- tooling) and by each merchant's own session for their own row only,
-- added once requireMerchantUser() exists to actually exercise it.
