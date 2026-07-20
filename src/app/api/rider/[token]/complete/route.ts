import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadActiveRiderToken, getDeviceLock } from "@/lib/rider/shared";

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

  // Shared with the auto-location path -- immediate token revocation either
  // way, distinguished only by delivery_confirmed_by ('human' here).
  await supabase.rpc("mark_order_delivered", {
    p_order_id: riderToken.order_id,
    p_confirmed_by: "human",
  });

  return NextResponse.json({ status: "ok" });
}
