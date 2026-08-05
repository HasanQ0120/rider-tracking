import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOpsUserApi } from "@/lib/ops/authGuardApi";
import { cleanPhoneInput, isValidPakistaniMobile } from "@/lib/phone";

// Partial update -- accepts any subset of {name, phone, license_plate, active}.
// Reused both by the Edit form (name/phone/license_plate) and the
// Deactivate/Activate toggle (active) so there's one endpoint, not two.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOpsUserApi();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    if (!body.name.trim()) return NextResponse.json({ status: "invalid_request" }, { status: 400 });
    update.name = body.name.trim();
  }
  if (typeof body.phone === "string") {
    if (!isValidPakistaniMobile(body.phone)) {
      return NextResponse.json({ status: "invalid_phone" }, { status: 400 });
    }
    update.phone = cleanPhoneInput(body.phone);
  }
  if (typeof body.license_plate === "string" || body.license_plate === null) {
    update.license_plate = typeof body.license_plate === "string" ? body.license_plate.trim() || null : null;
  }
  if (typeof body.active === "boolean") {
    update.active = body.active;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.from("riders").update(update).eq("id", id).select().maybeSingle();

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });
  if (!data) return NextResponse.json({ status: "invalid" }, { status: 404 });
  return NextResponse.json({ status: "ok", rider: data });
}
