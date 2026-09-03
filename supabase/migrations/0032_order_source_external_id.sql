-- Integration metadata for merchant API callers (Golootlo portal, POS, website).
alter table orders add column if not exists source text;
alter table orders add column if not exists external_order_id text;

create index if not exists idx_orders_tenant_external_order_id
  on orders(tenant_id, external_order_id)
  where external_order_id is not null;

comment on column orders.source is
  'Optional caller channel label from merchant API, e.g. golootlo, pos, website.';
comment on column orders.external_order_id is
  'Optional merchant/Golootlo-side order id for correlation.';
