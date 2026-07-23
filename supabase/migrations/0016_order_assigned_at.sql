alter table orders add column assigned_at timestamptz;

-- One-time backfill so already-assigned orders don't all tie at NULL and
-- sort ambiguously -- created_at is a reasonable one-time stand-in for
-- existing rows only; every assignment going forward sets this for real
-- (see the /api/ops/orders/[id]/assign route).
update orders set assigned_at = created_at where assigned_rider_id is not null;

create index idx_orders_rider_assigned_at on orders(assigned_rider_id, assigned_at)
  where status in ('assigned','in_transit','arrived');
