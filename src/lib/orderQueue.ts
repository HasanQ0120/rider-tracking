import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

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

  const { data: activeOrders } = await supabase
    .from("orders")
    .select("id, assigned_at")
    .eq("assigned_rider_id", order.assigned_rider_id)
    .in("status", ACTIVE_STATUSES)
    .order("assigned_at", { ascending: true })
    .order("id", { ascending: true });

  if (!activeOrders) return 0;
  const index = activeOrders.findIndex((o) => o.id === order.id);
  return index < 0 ? 0 : index;
}
