import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireMerchantUserApi } from "@/lib/merchant/authGuardApi";
import { getAllRiderLocationSnapshots } from "@/lib/riderLocation";

// Bulk variant of /api/merchant/riders/[id]/location for the "Show All" map.
// current_locations has no RLS policy (see the singular route's comment),
// so this filters to guard.tenantId itself via the service client, the same
// ownership boundary the singular route enforces per-rider.
export async function GET() {
  const guard = await requireMerchantUserApi();
  if ("error" in guard) return guard.error;

  const service = createServiceClient();
  const { data: riders } = await service
    .from("riders")
    .select("id")
    .eq("tenant_id", guard.tenantId)
    .eq("active", true);
  const snapshots = await getAllRiderLocationSnapshots(service, (riders ?? []).map((r) => r.id));

  return NextResponse.json({ status: "ok", snapshots });
}
