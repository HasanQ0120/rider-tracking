import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireMerchantUserApi } from "@/lib/merchant/authGuardApi";
import { performRiderAssignment } from "@/lib/assignRider";
import { customerTrackingUrl } from "@/lib/appUrl";
import { getActiveCustomerToken } from "@/lib/trackingTokens";

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

  const supabase = createServiceClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, tenant_id, status, assigned_rider_id, customer_name, customer_phone")
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

  try {
    const result = await performRiderAssignment(supabase, {
      orderId,
      riderId,
      riderPhone: rider.phone,
      customerPhone: order.customer_phone,
      customerName: order.customer_name,
      isReassignment,
    });

    const customerToken =
      result.customerTrackingToken ?? (await getActiveCustomerToken(supabase, orderId));

    return NextResponse.json({
      status: "ok",
      customer_tracking_url: customerToken ? customerTrackingUrl(customerToken) : null,
    });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
