import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOpsUserApi } from "@/lib/ops/authGuardApi";
import { getRiderLocationSnapshot } from "@/lib/riderLocation";

// Ops has unscoped cross-tenant visibility everywhere else in this app --
// same here, no tenant check needed before reading any rider's location.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOpsUserApi();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const supabase = createServiceClient();
  const snapshot = await getRiderLocationSnapshot(supabase, id);
  if (!snapshot) return NextResponse.json({ status: "invalid" }, { status: 404 });

  return NextResponse.json({ status: "ok", ...snapshot });
}
