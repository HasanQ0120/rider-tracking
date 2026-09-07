import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/admin/authGuardApi";
import { createServiceClient } from "@/lib/supabase/service";
import { cleanPhoneInput, isValidPakistaniMobile } from "@/lib/phone";

type RouteContext = { params: Promise<{ id: string; riderId: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const guard = await requirePlatformAdminApi();
  if ("error" in guard) return guard.error;

  const { id: tenantId, riderId } = await context.params;
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
    update.license_plate =
      typeof body.license_plate === "string" ? body.license_plate.trim() || null : null;
  }
  if (typeof body.active === "boolean") {
    update.active = body.active;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("riders")
    .update(update)
    .eq("id", riderId)
    .eq("tenant_id", tenantId)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });
  if (!data) return NextResponse.json({ status: "invalid" }, { status: 404 });
  return NextResponse.json({ status: "ok", rider: data });
}
