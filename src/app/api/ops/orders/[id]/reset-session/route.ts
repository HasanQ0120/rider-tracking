import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOpsUserApi } from "@/lib/ops/authGuardApi";

// Device-swap override: clears the device-lock so a new device can verify
// the PIN. The reset alone is not sufficient -- the rider must re-enter the
// PIN again on the new device before tracking resumes.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireOpsUserApi();
  if ("error" in guard) return guard.error;
  const { id: orderId } = await params;

  const supabase = createServiceClient();
  const { data: riderToken } = await supabase
    .from("tracking_tokens")
    .select("id")
    .eq("order_id", orderId)
    .eq("type", "rider")
    .eq("active", true)
    .maybeSingle();

  if (!riderToken) {
    return NextResponse.json({ status: "no_active_rider_token" }, { status: 404 });
  }

  await supabase.from("device_locks").delete().eq("rider_token_id", riderToken.id);
  await supabase
    .from("tracking_sessions")
    .update({ is_active: false, superseded_at: new Date().toISOString() })
    .eq("rider_token_id", riderToken.id)
    .eq("is_active", true);

  return NextResponse.json({ status: "ok" });
}
