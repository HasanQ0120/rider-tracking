import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireMerchantUserApi } from "@/lib/merchant/authGuardApi";
import { getRiderLocationSnapshot } from "@/lib/riderLocation";

// current_locations has RLS enabled with zero policies, so guard.supabase
// (RLS-scoped) would silently return nothing here -- a service-role client
// is required, which means this route (not the database) is what has to
// enforce that a merchant can only see their own riders.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMerchantUserApi();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const service = createServiceClient();

  const { data: rider } = await service.from("riders").select("tenant_id").eq("id", id).maybeSingle();
  if (!rider || rider.tenant_id !== guard.tenantId) {
    return NextResponse.json({ status: "invalid" }, { status: 404 });
  }

  const snapshot = await getRiderLocationSnapshot(service, id);
  if (!snapshot) return NextResponse.json({ status: "invalid" }, { status: 404 });

  return NextResponse.json({ status: "ok", ...snapshot });
}
