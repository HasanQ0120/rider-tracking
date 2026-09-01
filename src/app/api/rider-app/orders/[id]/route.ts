import { NextResponse } from "next/server";
import { requireRiderApi } from "@/lib/riderApp/authGuardApi";
import { RIDER_ORDER_COLUMNS } from "@/lib/riderApp/orders";
import { loadRiderOrder } from "@/lib/riderApp/delivery";
import { getOrdersAhead } from "@/lib/orderQueue";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRiderApi(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const order = await loadRiderOrder(auth.supabase, id, auth.riderId, RIDER_ORDER_COLUMNS);
  if (!order) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  const orders_ahead = await getOrdersAhead(auth.supabase, {
    id: order.id,
    assigned_rider_id: auth.riderId,
    status: order.status,
  });

  return NextResponse.json({ status: "ok", order: { ...order, orders_ahead } });
}
