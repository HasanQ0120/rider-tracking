import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/admin/authGuardApi";
import { createServiceClient } from "@/lib/supabase/service";
import { validateRiderFields } from "@/lib/riderValidation";
import { buildRiderInsertRows } from "@/lib/rider/insertRows";
import { sendAvailabilityLink } from "@/lib/notify";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const guard = await requirePlatformAdminApi();
  if ("error" in guard) return guard.error;

  const { id: tenantId } = await context.params;
  const service = createServiceClient();
  const { data, error } = await service
    .from("riders")
    .select("id, name, phone, license_plate, active, available, availability_token, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });
  return NextResponse.json({ riders: data });
}

export async function POST(req: Request, context: RouteContext) {
  const guard = await requirePlatformAdminApi();
  if ("error" in guard) return guard.error;

  const { id: tenantId } = await context.params;
  const body = await req.json().catch(() => null);
  const result = validateRiderFields(body ?? {});
  if (!result.ok) {
    return NextResponse.json({ status: "invalid_request", reason: result.reason }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: tenant } = await service.from("tenants").select("id").eq("id", tenantId).maybeSingle();
  if (!tenant) return NextResponse.json({ status: "not_found" }, { status: 404 });

  const [row] = await buildRiderInsertRows(tenantId, [result.rider]);
  const { data, error } = await service.from("riders").insert(row).select().single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ status: "duplicate_phone" }, { status: 409 });
    }
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
  await sendAvailabilityLink(row.phone, row.availability_token);
  return NextResponse.json({ rider: data });
}
