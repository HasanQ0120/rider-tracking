import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOpsUserApi } from "@/lib/ops/authGuardApi";
import { getOpsHomeTenantId } from "@/lib/ops/homeTenant";
import { parseRiderCsv } from "@/lib/riderCsv";

export async function POST(req: Request) {
  const guard = await requireOpsUserApi();
  if ("error" in guard) return guard.error;

  const { csv } = await req.json().catch(() => ({ csv: undefined }));
  if (typeof csv !== "string" || !csv.trim()) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const { valid, errors } = parseRiderCsv(csv);
  if (valid.length === 0) {
    return NextResponse.json({ status: "ok", imported: 0, errors });
  }

  const supabase = createServiceClient();
  const tenantId = await getOpsHomeTenantId(supabase);
  const { data, error } = await supabase
    .from("riders")
    .insert(
      valid.map((r) => ({
        tenant_id: tenantId,
        name: r.name,
        phone: r.phone,
        license_plate: r.license_plate,
      }))
    )
    .select();

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });
  return NextResponse.json({ status: "ok", imported: data?.length ?? 0, riders: data, errors });
}
