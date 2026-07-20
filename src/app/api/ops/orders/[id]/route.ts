import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOpsUserApi } from "@/lib/ops/authGuardApi";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireOpsUserApi();
  if ("error" in guard) return guard.error;
  const { id } = await params;

  const supabase = createServiceClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, customer_name, customer_phone, delivery_address, delivery_lat, delivery_lng, status, assigned_rider_id, tracking_expired_unresolved, delivery_confirmed_by, rider_arrived_at, created_at, delivered_at, riders:assigned_rider_id(name, phone)"
    )
    .eq("id", id)
    .single();

  if (error || !order) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  const { data: tokens } = await supabase
    .from("tracking_tokens")
    .select("id, type, active, expires_at, revoked_reason, created_at")
    .eq("order_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ order, tokens });
}
