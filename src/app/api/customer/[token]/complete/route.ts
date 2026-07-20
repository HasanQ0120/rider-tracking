import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { haversineMeters } from "@/lib/geo";
import { PROXIMITY_RADIUS_M } from "@/lib/config";

// Enforced server-side, not just hidden behind a UI gate -- calling this
// directly before the rider has arrived (e.g. by force-showing the button
// via DevTools) still returns 403.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: tokenRow } = await supabase
    .from("tracking_tokens")
    .select("id, order_id, active")
    .eq("token", token)
    .eq("type", "customer")
    .eq("active", true)
    .maybeSingle();

  if (!tokenRow) {
    return NextResponse.json({ status: "invalid" }, { status: 404 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, rider_arrived_at, delivery_lat, delivery_lng")
    .eq("id", tokenRow.order_id)
    .single();

  if (!order) {
    return NextResponse.json({ status: "invalid" }, { status: 404 });
  }
  if (order.status === "delivered" || order.status === "cancelled") {
    return NextResponse.json({ status: "ok" });
  }

  let allowed = Boolean(order.rider_arrived_at);
  if (!allowed && order.delivery_lat != null && order.delivery_lng != null) {
    const { data: loc } = await supabase
      .from("current_locations")
      .select("lat, lng")
      .eq("order_id", order.id)
      .maybeSingle();
    if (loc) {
      const dist = haversineMeters(order.delivery_lat, order.delivery_lng, loc.lat, loc.lng);
      allowed = dist <= PROXIMITY_RADIUS_M;
    }
  }

  if (!allowed) {
    return NextResponse.json({ status: "not_arrived" }, { status: 403 });
  }

  await supabase.rpc("mark_order_delivered", {
    p_order_id: order.id,
    p_confirmed_by: "human",
  });

  return NextResponse.json({ status: "ok" });
}
