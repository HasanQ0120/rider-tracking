import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOpsUserApi } from "@/lib/ops/authGuardApi";
import { getOpsHomeTenantId } from "@/lib/ops/homeTenant";
import { validateRiderFields } from "@/lib/riderValidation";
import { buildRiderInsertRows } from "@/lib/rider/insertRows";
import { sendAvailabilityLink } from "@/lib/notify";

export async function GET() {
  const guard = await requireOpsUserApi();
  if ("error" in guard) return guard.error;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("riders")
    .select("id, name, phone, license_plate, active, available, availability_token, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });
  return NextResponse.json({ riders: data });
}

export async function POST(req: Request) {
  const guard = await requireOpsUserApi();
  if ("error" in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const result = validateRiderFields(body ?? {});
  if (!result.ok) {
    return NextResponse.json({ status: "invalid_request", reason: result.reason }, { status: 400 });
  }

  const supabase = createServiceClient();
  const tenantId = await getOpsHomeTenantId(supabase);
  const [row] = await buildRiderInsertRows(tenantId, [result.rider]);

  const { data, error } = await supabase.from("riders").insert(row).select().single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ status: "duplicate_phone" }, { status: 409 });
    }
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
  await sendAvailabilityLink(row.phone, row.availability_token);
  return NextResponse.json({ rider: data });
}
