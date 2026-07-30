import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadRiderByDutyToken } from "@/lib/rider/duty";
import { generateSessionId } from "@/lib/tokens";
import { DUTY_LOCATION_STALE_TIMEOUT_S } from "@/lib/config";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();
  const rider = await loadRiderByDutyToken(supabase, token);
  if (!rider) {
    return NextResponse.json({ status: "invalid" });
  }
  if (!rider.active) {
    return NextResponse.json({ status: "inactive" });
  }

  // Reopening the link (e.g. a mobile browser reloading a backgrounded tab)
  // shouldn't blind the rider back to the check-in button if they already
  // have a fresh session running underneath -- resume it instead of handing
  // out an unrelated new session id.
  const { data: existing } = await supabase
    .from("rider_duty_locations")
    .select("session_id, recorded_at")
    .eq("rider_id", rider.id)
    .maybeSingle();

  const isFresh =
    !!existing &&
    Date.now() - new Date(existing.recorded_at).getTime() < DUTY_LOCATION_STALE_TIMEOUT_S * 1000;

  if (isFresh) {
    return NextResponse.json({
      status: "ok",
      riderName: rider.name,
      sessionId: existing.session_id,
      onDuty: true,
      recordedAt: existing.recorded_at,
    });
  }

  return NextResponse.json({ status: "ok", riderName: rider.name, sessionId: generateSessionId() });
}
