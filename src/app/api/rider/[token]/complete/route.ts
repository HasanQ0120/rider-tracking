import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadActiveRiderToken, getDeviceLock } from "@/lib/rider/shared";
import { haversineMeters } from "@/lib/geo";
import { PROXIMITY_RADIUS_M } from "@/lib/config";

// Replaces the old "tap = instantly delivered" behavior. The rider's tap
// is now just a request to close out the delivery -- what actually
// happens depends on whether their last known position is plausibly at
// the delivery address:
//  - within radius: hand off to the customer for a Yes/No confirmation
//    (pending_confirmation), never marked delivered on the rider's say
//    alone.
//  - too far away (or no location on record at all, which we can't
//    distinguish from "too far" -- treated the same, conservatively):
//    flagged for review immediately, skipping the customer prompt
//    entirely.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { device_key } = await req.json();

  const supabase = createServiceClient();
  const riderToken = await loadActiveRiderToken(supabase, token);
  if (!riderToken) {
    return NextResponse.json({ status: "invalid" }, { status: 404 });
  }

  const lockedDeviceKey = await getDeviceLock(supabase, riderToken.id);
  if (!lockedDeviceKey || lockedDeviceKey !== device_key) {
    return NextResponse.json({ status: "blocked_device" }, { status: 403 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, delivery_lat, delivery_lng")
    .eq("id", riderToken.order_id)
    .single();
  if (!order) {
    return NextResponse.json({ status: "invalid" }, { status: 404 });
  }

  const { data: loc } = await supabase
    .from("current_locations")
    .select("lat, lng")
    .eq("order_id", order.id)
    .maybeSingle();

  const withinRadius =
    loc != null &&
    order.delivery_lat != null &&
    order.delivery_lng != null &&
    haversineMeters(order.delivery_lat, order.delivery_lng, loc.lat, loc.lng) <= PROXIMITY_RADIUS_M;

  if (withinRadius) {
    await supabase.rpc("set_pending_confirmation", { p_order_id: order.id });
    return NextResponse.json({ status: "pending_confirmation" });
  }

  await supabase.rpc("flag_order_for_review", {
    p_order_id: order.id,
    p_reason: "far_from_address",
  });
  return NextResponse.json({ status: "flagged", reason: "far_from_address" });
}
