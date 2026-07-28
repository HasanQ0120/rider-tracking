import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadRiderByDutyToken } from "@/lib/rider/duty";
import { MAX_ACCURACY_M, DUTY_LOCATION_MIN_INTERVAL_MS } from "@/lib/config";

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
