import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadActiveRiderToken, getDeviceLock } from "@/lib/rider/shared";
import { generateSessionId } from "@/lib/tokens";
import { CONNECTION_LOST_TIMEOUT_S } from "@/lib/config";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { device_key } = await req.json().catch(() => ({ device_key: undefined }));

  const supabase = createServiceClient();
  const riderToken = await loadActiveRiderToken(supabase, token);
  if (!riderToken) {
    return NextResponse.json({ status: "invalid" });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, delivery_lat, delivery_lng, delivery_address, address_detail, customer_name, customer_phone")
    .eq("id", riderToken.order_id)
    .single();

  if (!order || order.status === "delivered" || order.status === "cancelled") {
    return NextResponse.json({ status: "closed" });
  }

  // Lockout blocks new PIN attempts only -- it never interrupts a session
  // that's already unlocked, which is why this check happens before the
  // device-match branch below, not instead of it.
  if (riderToken.pin_locked_until && new Date(riderToken.pin_locked_until) > new Date()) {
    return NextResponse.json({
      status: "locked_out",
      lockedUntil: riderToken.pin_locked_until,
    });
  }

  const lockedDeviceKey = await getDeviceLock(supabase, riderToken.id);

  if (!lockedDeviceKey) {
    return NextResponse.json({ status: "need_pin", order });
  }

  if (!device_key || device_key !== lockedDeviceKey) {
    return NextResponse.json({ status: "blocked_device" });
  }

  // If tracking is still genuinely live (a position was reported recently),
  // resume that same session instead of blindly superseding it -- otherwise
  // a reloaded tab (mobile backgrounding, same trigger as the duty check-in
  // bug) drops back to "Start Sharing My Location" over a delivery that's
  // already in progress, and the customer's map goes stale in the meantime.
  const { data: recentLocation } = await supabase
    .from("current_locations")
    .select("recorded_at")
    .eq("order_id", order.id)
    .maybeSingle();
  const isLive =
    !!recentLocation &&
    Date.now() - new Date(recentLocation.recorded_at).getTime() < CONNECTION_LOST_TIMEOUT_S * 1000;

  if (isLive) {
    const { data: activeSession } = await supabase
      .from("tracking_sessions")
      .select("session_id")
      .eq("rider_token_id", riderToken.id)
      .eq("is_active", true)
      .maybeSingle();
    if (activeSession) {
      return NextResponse.json({
        status: "active",
        sessionId: activeSession.session_id,
        order,
        resuming: true,
      });
    }
  }

  // Same device reopening the link is always allowed and never needs the
  // PIN again -- mint a fresh session and supersede any prior one so a
  // stale tab elsewhere is told to stop on its next location send.
  const sessionId = generateSessionId();
  const { error: supersedeError } = await supabase
    .from("tracking_sessions")
    .update({ is_active: false, superseded_at: new Date().toISOString() })
    .eq("rider_token_id", riderToken.id)
    .eq("is_active", true);
  if (supersedeError) {
    console.error("[rider/init] failed to supersede previous session", supersedeError);
  }
  const { error: insertError } = await supabase
    .from("tracking_sessions")
    .insert({ rider_token_id: riderToken.id, session_id: sessionId });
  if (insertError) {
    console.error("[rider/init] failed to create tracking session", insertError);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  return NextResponse.json({ status: "active", sessionId, order });
}
