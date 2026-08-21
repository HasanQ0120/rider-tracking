import { NextResponse } from "next/server";
import { requireMerchantUserApi } from "@/lib/merchant/authGuardApi";
import { cleanPhoneInput, isValidPakistaniMobile } from "@/lib/phone";

// Same partial-update shape as the ops route. Uses guard.supabase (RLS-scoped,
// not service-role) -- the "merchant updates own riders" policy is what
// actually enforces that this only ever succeeds for this merchant's own
// rider; a foreign id just matches zero rows, not a cross-tenant leak.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMerchantUserApi();
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

  const { data, error } = await guard.supabase.from("riders").update(update).eq("id", id).select().maybeSingle();

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });
  if (!data) return NextResponse.json({ status: "invalid" }, { status: 404 });
  return NextResponse.json({ status: "ok", rider: data });
}
