-- The existing business becomes tenant #1 -- merchant_id/name are trivial
-- to rename via SQL before any other merchant is provisioned, so a
-- placeholder here isn't worth blocking on.
insert into tenants (merchant_id, name)
values ('MERCHANT001', 'Rider Tracking');

alter table orders add column tenant_id uuid references tenants(id);
alter table riders add column tenant_id uuid references tenants(id);

update orders set tenant_id = (select id from tenants where merchant_id = 'MERCHANT001');
update riders set tenant_id = (select id from tenants where merchant_id = 'MERCHANT001');

alter table orders alter column tenant_id set not null;
alter table riders alter column tenant_id set not null;

create index idx_orders_tenant on orders(tenant_id);
create index idx_orders_tenant_status on orders(tenant_id, status);
create index idx_riders_tenant on riders(tenant_id);
