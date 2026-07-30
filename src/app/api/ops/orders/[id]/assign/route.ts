import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOpsUserApi } from "@/lib/ops/authGuardApi";
import { performRiderAssignment } from "@/lib/assignRider";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireOpsUserApi();
  if ("error" in guard) return guard.error;
  const { id: orderId } = await params;
  const { riderId, confirmReassign } = await req.json();

  if (!riderId) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, assigned_rider_id, customer_name, customer_phone")
    .eq("id", orderId)
    .single();

  if (!order) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }
  if (order.status === "delivered" || order.status === "cancelled") {
    return NextResponse.json({ status: "order_closed" }, { status: 409 });
  }

  const { data: rider } = await supabase
    .from("riders")
    .select("id, name, phone")
    .eq("id", riderId)
    .single();
  if (!rider) {
    return NextResponse.json({ status: "rider_not_found" }, { status: 404 });
  }

  // An order should only ever have one active rider token at a time --
  // reassigning over an existing assignment requires explicit confirmation
  // rather than silently overwriting it (catches ops data-entry mistakes).
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
      customerName: order.customer_name,
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
