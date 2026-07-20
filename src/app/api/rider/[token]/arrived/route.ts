import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadActiveRiderToken, getDeviceLock } from "@/lib/rider/shared";

// Manual fallback for poor GPS / old browsers, and the trigger that unlocks
// the customer's Complete button server-side (see /api/customer/[token]/complete).
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

  await supabase
    .from("orders")
    .update({ status: "arrived", rider_arrived_at: new Date().toISOString() })
    .eq("id", riderToken.order_id)
    .not("status", "in", "(delivered,cancelled)");

  return NextResponse.json({ status: "ok" });
}
