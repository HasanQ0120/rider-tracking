import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadActiveRiderToken, getDeviceLock, isActiveSession } from "@/lib/rider/shared";
import { computeSpeedKmh, isSpeedImplausible, computeBearing } from "@/lib/geo";
import { MAX_ACCURACY_M, LOCATION_MIN_INTERVAL_MS } from "@/lib/config";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { lat, lng, accuracy_m, session_id, device_key } = await req.json();

  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    typeof accuracy_m !== "number" ||
    !session_id ||
    !device_key
  ) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const riderToken = await loadActiveRiderToken(supabase, token);
  if (!riderToken) {
    return NextResponse.json({ status: "invalid" }, { status: 404 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", riderToken.order_id)
    .single();
  if (!order || order.status === "delivered" || order.status === "cancelled") {
    return NextResponse.json({ status: "closed" }, { status: 409 });
  }

  const lockedDeviceKey = await getDeviceLock(supabase, riderToken.id);
  if (!lockedDeviceKey || lockedDeviceKey !== device_key) {
    return NextResponse.json({ status: "blocked_device" }, { status: 403 });
  }

  // Only the currently active session may keep sending -- an older tab that
  // got superseded is told to stop rather than silently failing.
  if (!(await isActiveSession(supabase, riderToken.id, session_id))) {
    return NextResponse.json({ status: "session_superseded" }, { status: 409 });
  }

  // Readings worse than the accuracy floor are rejected outright, never
  // written -- the rider UI shows "waiting for accurate signal" instead.
  if (accuracy_m > MAX_ACCURACY_M) {
    return NextResponse.json({ status: "inaccurate" });
  }

  const { data: previous } = await supabase
    .from("current_locations")
    .select("lat, lng, recorded_at")
    .eq("order_id", order.id)
    .maybeSingle();

  const now = new Date();
  if (previous) {
    const elapsedMs = now.getTime() - new Date(previous.recorded_at).getTime();
    if (elapsedMs < LOCATION_MIN_INTERVAL_MS) {
      return NextResponse.json({ status: "rate_limited" });
    }
  }

  let speedKmh: number | null = null;
  let speedImplausible = false;
  let heading: number | null = null;
  if (previous) {
    speedKmh = computeSpeedKmh(
      previous.lat,
      previous.lng,
      new Date(previous.recorded_at),
      lat,
      lng,
      now
    );
    // Soft flag only -- never blocks the write. Full spoof-prevention isn't
    // solvable in a browser without a native app; this just gives ops a
    // signal to look at, catching obvious teleports while still tolerating
    // fast-but-real movement in traffic.
    speedImplausible = isSpeedImplausible(speedKmh);
    // Computed once here (not separately by each viewer) so the rider's own
    // page and the customer's page always agree on which way the arrow
    // points.
    heading = computeBearing(previous.lat, previous.lng, lat, lng);
  }

  await supabase.from("current_locations").upsert({
    order_id: order.id,
    lat,
    lng,
    accuracy_m,
    speed_kmh: speedKmh,
    speed_implausible: speedImplausible,
    heading,
    session_id,
    recorded_at: now.toISOString(),
  });

  await supabase.from("location_history").insert({
    order_id: order.id,
    lat,
    lng,
    accuracy_m,
    speed_kmh: speedKmh,
    recorded_at: now.toISOString(),
  });

  if (order.status === "assigned") {
    await supabase.from("orders").update({ status: "in_transit" }).eq("id", order.id);
  }

  return NextResponse.json({ status: "ok", speedImplausible, heading });
}
