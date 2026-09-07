import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/admin/authGuardApi";
import { createServiceClient } from "@/lib/supabase/service";
import { getRiderLocationSnapshot } from "@/lib/riderLocation";

type RouteContext = { params: Promise<{ id: string; riderId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const guard = await requirePlatformAdminApi();
  if ("error" in guard) return guard.error;

  const { id: tenantId, riderId } = await context.params;
  const service = createServiceClient();
  const { data: rider } = await service
    .from("riders")
    .select("id")
    .eq("id", riderId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!rider) return NextResponse.json({ status: "invalid" }, { status: 404 });

  const snapshot = await getRiderLocationSnapshot(service, riderId);
  if (!snapshot) return NextResponse.json({ status: "invalid" }, { status: 404 });

  return NextResponse.json({ status: "ok", ...snapshot });
}
