import { NextResponse } from "next/server";
import { requireRiderApi } from "@/lib/riderApp/authGuardApi";
import { isValidLoginPin, LOGIN_PIN_HINT } from "@/lib/riderApp/pin";
import { hashPin, verifyPin } from "@/lib/tokens";

export async function POST(req: Request) {
  const auth = await requireRiderApi(req);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const { current_pin, new_pin } = body as { current_pin?: unknown; new_pin?: unknown };
  if (!isValidLoginPin(current_pin) || !isValidLoginPin(new_pin)) {
    return NextResponse.json({ status: "invalid_pin", hint: LOGIN_PIN_HINT }, { status: 400 });
  }
  if (current_pin === new_pin) {
    return NextResponse.json({ status: "same_pin" }, { status: 400 });
  }

  const { data: rider, error: fetchError } = await auth.supabase
    .from("riders")
    .select("login_pin_hash")
    .eq("id", auth.riderId)
    .eq("tenant_id", auth.tenantId)
    .single();

  if (fetchError || !rider?.login_pin_hash) {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  const currentOk = await verifyPin(current_pin, rider.login_pin_hash);
  if (!currentOk) {
    return NextResponse.json({ status: "invalid_current_pin" }, { status: 401 });
  }

  const newHash = await hashPin(new_pin);
  const { error: updateError } = await auth.supabase
    .from("riders")
    .update({ login_pin_hash: newHash })
    .eq("id", auth.riderId)
    .eq("tenant_id", auth.tenantId);

  if (updateError) {
    console.error("[rider-app/change-pin] update failed", updateError);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
