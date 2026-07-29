import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireMerchantUserApi } from "@/lib/merchant/authGuardApi";
import { performRiderAssignment } from "@/lib/assignRider";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireMerchantUserApi();
  if ("error" in guard) return guard.error;
  const { id: orderId } = await params;
  const { riderId, confirmReassign } = await req.json();

  if (!riderId) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  // Service-role for the actual write (performRiderAssignment needs
  // tracking_tokens/pin_codes writes the merchant's own RLS grants don't
  // cover) -- which is exactly why the two tenant_id checks below are not
  // optional. Unlike ops (intentionally cross-tenant), a merchant session
  // must never be able to assign its own rider to another tenant's order,
  // or another tenant's rider to its own order -- RLS doesn't guard this
  // path (it's service-role), so the application code is the enforcement.
  const supabase = createServiceClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, tenant_id, status, assigned_rider_id, customer_phone")
    .eq("id", orderId)
    .single();

  if (!order || order.tenant_id !== guard.tenantId) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }
  if (order.status === "delivered" || order.status === "cancelled") {
    return NextResponse.json({ status: "order_closed" }, { status: 409 });
  }

  const { data: rider } = await supabase
    .from("riders")
    .select("id, tenant_id, name, phone")
    .eq("id", riderId)
    .single();
  if (!rider || rider.tenant_id !== guard.tenantId) {
    return NextResponse.json({ status: "rider_not_found" }, { status: 404 });
  }

  const isReassignment = Boolean(order.assigned_rider_id);
  if (isReassignment && !confirmReassign) {
    return NextResponse.json({ status: "needs_confirmation" }, { status: 409 });
  }

  let pin: string | null;
  try {
    pin = await performRiderAssignment(supabase, {
      orderId,
      riderId,
      riderPhone: rider.phone,
      customerPhone: order.customer_phone,
      isReassignment,
    });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  return NextResponse.json({
    status: "ok",
    pin: pin ?? undefined,
  });
}
