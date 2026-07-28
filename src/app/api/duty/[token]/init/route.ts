import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadRiderByDutyToken } from "@/lib/rider/duty";
import { generateSessionId } from "@/lib/tokens";

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
  return NextResponse.json({ status: "ok", riderName: rider.name, sessionId: generateSessionId() });
}
