import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadRiderByDutyToken } from "@/lib/rider/duty";
import { checkDutyGeofence } from "@/lib/rider/dutyGeofence";
import {
  MAX_ACCURACY_M,
  DUTY_LOCATION_MIN_INTERVAL_MS,
  DUTY_LOCATION_STALE_TIMEOUT_S,
} from "@/lib/config";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { lat, lng, accuracy_m, session_id } = await req.json();

  if (typeof lat !== "number" || typeof lng !== "number" || typeof accuracy_m !== "number" || !session_id) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const rider = await loadRiderByDutyToken(supabase, token);
  if (!rider) {
    return NextResponse.json({ status: "invalid" }, { status: 404 });
  }
  if (!rider.active) {
    return NextResponse.json({ status: "inactive" }, { status: 409 });
  }

  if (accuracy_m > MAX_ACCURACY_M) {
    return NextResponse.json({ status: "inaccurate" });
  }

  const { data: previous } = await supabase
    .from("rider_duty_locations")
    .select("recorded_at")
    .eq("rider_id", rider.id)
    .maybeSingle();

  const now = new Date();

  // No fresh existing session means this ping is the check-in moment --
  // that's the one that's geofence-gated. A rider already on duty (fresh
  // row present) just keeps refreshing position on subsequent pings
  // without being re-checked every tick; only the initial "Go On Duty" tap
  // has to prove they're actually near the pickup point.
  const hasFreshSession =
    !!previous &&
    now.getTime() - new Date(previous.recorded_at).getTime() < DUTY_LOCATION_STALE_TIMEOUT_S * 1000;

  if (!hasFreshSession) {
    const geofence = await checkDutyGeofence(supabase, rider.tenant_id, lat, lng);
    if (!geofence.ok) {
      return NextResponse.json({
        status: "too_far",
        distanceMeters: geofence.distanceMeters,
        radiusMeters: geofence.radiusMeters,
        pickupLocationName: geofence.pickupLocationName,
      });
    }
  }

  if (previous) {
    const elapsedMs = now.getTime() - new Date(previous.recorded_at).getTime();
    if (elapsedMs < DUTY_LOCATION_MIN_INTERVAL_MS) {
      return NextResponse.json({ status: "rate_limited" });
    }
  }

  await supabase.from("rider_duty_locations").upsert({
    rider_id: rider.id,
    lat,
    lng,
    recorded_at: now.toISOString(),
    session_id,
  });

  return NextResponse.json({ status: "ok" });
}
