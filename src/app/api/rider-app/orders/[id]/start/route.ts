import { NextResponse } from "next/server";
import { requireRiderApi } from "@/lib/riderApp/authGuardApi";
import { RIDER_ORDER_COLUMNS } from "@/lib/riderApp/orders";
import { loadRiderOrder, startDeliverySession } from "@/lib/riderApp/delivery";
import { getOrdersAhead } from "@/lib/orderQueue";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRiderApi(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const order = await loadRiderOrder(auth.supabase, id, auth.riderId, RIDER_ORDER_COLUMNS);
  if (!order) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  const ordersAhead = await getOrdersAhead(auth.supabase, {
    id: order.id,
    assigned_rider_id: auth.riderId,
    status: order.status,
  });
  if (ordersAhead > 0) {
    return NextResponse.json(
      { status: "queued", orders_ahead: ordersAhead, message: "Complete earlier deliveries first." },
      { status: 409 }
    );
  }

  const result = await startDeliverySession(auth.supabase, order, auth.riderId);
  if (!result.ok) {
    return NextResponse.json({ status: result.code }, { status: result.status });
  }

  return NextResponse.json({
    status: "ok",
    session_id: result.sessionId,
    resuming: result.resuming,
    order: result.order,
  });
}
