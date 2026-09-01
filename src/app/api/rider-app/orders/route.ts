import { NextResponse } from "next/server";
import { requireRiderApi } from "@/lib/riderApp/authGuardApi";
import {
  RIDER_ACTIVE_STATUSES,
  RIDER_HISTORY_STATUSES,
  RIDER_ORDER_COLUMNS,
  type RiderOrderRow,
} from "@/lib/riderApp/orders";
import { getOrdersAhead } from "@/lib/orderQueue";

export async function GET(req: Request) {
  const auth = await requireRiderApi(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "active";

  let statusFilter: readonly string[];
  if (scope === "history") {
    statusFilter = RIDER_HISTORY_STATUSES;
  } else if (scope === "all") {
    statusFilter = [...RIDER_ACTIVE_STATUSES, ...RIDER_HISTORY_STATUSES];
  } else {
    statusFilter = RIDER_ACTIVE_STATUSES;
  }

  const { data: orders, error } = await auth.supabase
    .from("orders")
    .select(RIDER_ORDER_COLUMNS)
    .eq("assigned_rider_id", auth.riderId)
    .in("status", [...statusFilter])
    .order("assigned_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[rider-app/orders] list failed", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  const rows = (orders ?? []) as RiderOrderRow[];
  const withQueue = await Promise.all(
    rows.map(async (order) => ({
      ...order,
      orders_ahead: await getOrdersAhead(auth.supabase, {
        id: order.id,
        assigned_rider_id: auth.riderId,
        status: order.status,
      }),
    }))
  );

  return NextResponse.json({ status: "ok", orders: withQueue });
}
