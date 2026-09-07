import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/admin/authGuardApi";
import { createServiceClient } from "@/lib/supabase/service";
import { parseRiderCsv } from "@/lib/riderCsv";
import { buildRiderInsertRows } from "@/lib/rider/insertRows";
import { sendAvailabilityLink } from "@/lib/notify";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const guard = await requirePlatformAdminApi();
  if ("error" in guard) return guard.error;

  const { id: tenantId } = await context.params;
  const { csv } = await req.json().catch(() => ({ csv: undefined }));
  if (typeof csv !== "string" || !csv.trim()) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: tenant } = await service.from("tenants").select("id").eq("id", tenantId).maybeSingle();
  if (!tenant) return NextResponse.json({ status: "not_found" }, { status: 404 });

  const { valid, errors } = parseRiderCsv(csv);
  if (valid.length === 0) {
    return NextResponse.json({ status: "ok", imported: 0, errors });
  }

  const withTokens = await buildRiderInsertRows(tenantId, valid);
  const { data, error } = await service.from("riders").insert(withTokens).select();

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });
  await Promise.all(withTokens.map((r) => sendAvailabilityLink(r.phone, r.availability_token)));
  return NextResponse.json({ status: "ok", imported: data?.length ?? 0, riders: data, errors });
}
