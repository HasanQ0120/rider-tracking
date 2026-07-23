import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrdersAhead } from "@/lib/orderQueue";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: tokenRow } = await supabase
    .from("tracking_tokens")
    .select("id, order_id, active, expires_at")
    .eq("token", token)
    .eq("type", "customer")
    .eq("active", true)
    .maybeSingle();

  const notExpired =
    tokenRow && (!tokenRow.expires_at || new Date(tokenRow.expires_at) > new Date());

  if (!tokenRow || !notExpired) {
    return NextResponse.json({ status: "invalid" }, { status: 404 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, status, delivery_address, address_detail, delivery_lat, delivery_lng, rider_arrived_at, tracking_expired_unresolved, assigned_rider_id"
    )
    .eq("id", tokenRow.order_id)
    .single();

  if (!order) {
    return NextResponse.json({ status: "invalid" }, { status: 404 });
  }

  const ordersAhead = await getOrdersAhead(supabase, order);

  let rider: { name: string; phone: string; license_plate: string | null } | null = null;
  if (order.assigned_rider_id) {
    const { data } = await supabase
      .from("riders")
      .select("name, phone, license_plate")
      .eq("id", order.assigned_rider_id)
      .single();
    rider = data ?? null;
  }

  return NextResponse.json({
    status: "ok",
    order: { ...order, orders_ahead: ordersAhead },
    rider,
  });
}
