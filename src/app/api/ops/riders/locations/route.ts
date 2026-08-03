import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOpsUserApi } from "@/lib/ops/authGuardApi";
import { getAllRiderLocationSnapshots } from "@/lib/riderLocation";

// Bulk variant of /api/ops/riders/[id]/location for the "Show All" map --
// ops has unscoped cross-tenant visibility everywhere else in this app
// (matches the existing, un-filtered ops riders list), same here.
export async function GET() {
  const guard = await requireOpsUserApi();
  if ("error" in guard) return guard.error;

  const supabase = createServiceClient();
  const { data: riders } = await supabase.from("riders").select("id").eq("active", true);
  const snapshots = await getAllRiderLocationSnapshots(supabase, (riders ?? []).map((r) => r.id));

  return NextResponse.json({ status: "ok", snapshots });
}
