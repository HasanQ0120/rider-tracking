import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadRiderByDutyToken } from "@/lib/rider/duty";

// Deletes the rider's duty-location row outright rather than flagging it
// inactive -- an explicit "go off duty" should stop them counting as
// available for auto-assignment immediately, not just once the staleness
// cutoff eventually catches up.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();
  const rider = await loadRiderByDutyToken(supabase, token);
  if (!rider) {
    return NextResponse.json({ status: "invalid" }, { status: 404 });
  }
  await supabase.from("rider_duty_locations").delete().eq("rider_id", rider.id);
  return NextResponse.json({ status: "ok" });
}
