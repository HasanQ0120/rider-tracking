import { requireOpsUser } from "@/lib/ops/authGuard";
import { createServiceClient } from "@/lib/supabase/service";
import { OrderDetail } from "@/components/ops/OrderDetail";
import { notFound } from "next/navigation";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOpsUser();
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, customer_name, customer_phone, delivery_address, address_detail, delivery_lat, delivery_lng, status, assigned_rider_id, tracking_expired_unresolved, delivery_confirmed_by, review_flag_reason, rider_arrived_at, pending_confirmation_at, created_at, delivered_at"
    )
    .eq("id", id)
    .single();

  if (!order) notFound();

  // Display-only rank for the "ORD-000N" code -- no such column exists, so
  // it's derived from how many orders were created at or before this one.
  const { count: orderRank } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .lte("created_at", order.created_at);

  const { data: tokens } = await supabase
    .from("tracking_tokens")
    .select("id, token, type, active, expires_at, revoked_reason, created_at")
    .eq("order_id", id)
    .order("created_at", { ascending: false });

  const { data: riders } = await supabase
    .from("riders")
    .select("id, name, phone")
    .eq("active", true)
    .order("name");

  return (
    <OrderDetail
      order={order}
      orderRank={orderRank ?? 1}
      tokens={tokens ?? []}
      riders={riders ?? []}
    />
  );
}
