import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/admin/authGuardApi";
import { createServiceClient } from "@/lib/supabase/service";
import { getAllRiderLocationSnapshots } from "@/lib/riderLocation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const guard = await requirePlatformAdminApi();
  if ("error" in guard) return guard.error;

  const { id: tenantId } = await context.params;
  const service = createServiceClient();
  const { data: riders } = await service
    .from("riders")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("active", true);

  const snapshots = await getAllRiderLocationSnapshots(
    service,
    (riders ?? []).map((r) => r.id)
  );

  return NextResponse.json({ status: "ok", snapshots });
}
