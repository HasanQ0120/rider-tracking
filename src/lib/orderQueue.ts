import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONNECTION_LOST_TIMEOUT_S } from "@/lib/config";

// A rider's order is "in progress" for queue-ranking purposes in exactly
// these statuses -- pending_confirmation/flagged_review deliberately excluded,
// since by the time an order reaches either of those the rider has already
// physically left it (dropped off, moved on), so counting it would overstate
// how many deliveries are still ahead of a sibling order.
const ACTIVE_STATUSES = ["assigned", "in_transit", "arrived"];

// Returns how many of this rider's other active orders were assigned before
// this one -- 0 means this is the rider's current delivery (show the normal
// live map); N>0 means there are N deliveries still ahead of it in the
// rider's queue. Ranked by assigned_at, not created_at, since an order can
// be created long before/after it's actually assigned, and reassignment can
// happen out of creation order.
export async function getOrdersAhead(
  supabase: SupabaseClient,
  order: { id: string; assigned_rider_id: string | null; status: string }
): Promise<number> {
  if (!order.assigned_rider_id || !ACTIVE_STATUSES.includes(order.status)) {
    return 0;
  }

  // Real GPS evidence overrides formal assignment order: if the rider is
  // currently sending location pings for THIS order right now, it's their
  // effectively-current delivery no matter what assigned_at ranking says --
  // e.g. an earlier order that got skipped/stuck without being formally
  // closed out shouldn't leave a later, genuinely-in-progress order's
  // customer stuck on the queue screen. Same staleness cutoff already used
  // elsewhere for "is this rider still actively connected."
  const staleCutoff = new Date(Date.now() - CONNECTION_LOST_TIMEOUT_S * 1000).toISOString();
  const { data: ownLocation } = await supabase
    .from("current_locations")
    .select("recorded_at")
    .eq("order_id", order.id)
    .gt("recorded_at", staleCutoff)
    .maybeSingle();
  if (ownLocation) return 0;

  const { data: activeOrders } = await supabase
    .from("orders")
    .select("id, assigned_at")
    .eq("assigned_rider_id", order.assigned_rider_id)
    .in("status", ACTIVE_STATUSES)
    .order("assigned_at", { ascending: true })
    .order("id", { ascending: true });

  if (!activeOrders) return 0;

  // Same GPS-evidence override, applied to siblings: if the rider skipped
  // this order and is instead actively pinging a *different* one of their
  // active orders, that's the real number of deliveries in the way right
  // now -- not this order's assigned_at rank, which would otherwise still
  // count already-resolved or never-started siblings as "ahead" (or, once
  // an earlier sibling is delivered, wrongly rank this order as "current"
  // just because it was assigned first).
  const otherIds = activeOrders.map((o) => o.id).filter((id) => id !== order.id);
  if (otherIds.length > 0) {
    const { data: liveOthers } = await supabase
      .from("current_locations")
      .select("order_id")
      .in("order_id", otherIds)
      .gt("recorded_at", staleCutoff);
    if (liveOthers && liveOthers.length > 0) return liveOthers.length;
  }

  const index = activeOrders.findIndex((o) => o.id === order.id);
  return index < 0 ? 0 : index;
}
