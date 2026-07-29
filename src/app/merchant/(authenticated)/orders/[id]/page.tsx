import { requireMerchantUser } from "@/lib/merchant/authGuard";
import { createAuthServerClient } from "@/lib/supabase/serverAuth";
import { createServiceClient } from "@/lib/supabase/service";
import { OrderDetail } from "@/components/ops/OrderDetail";
import { notFound } from "next/navigation";

export default async function MerchantOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireMerchantUser();
  const { id } = await params;
  // RLS-authenticated client -- the "merchant reads own orders" policy is
  // what actually proves this order belongs to this merchant's tenant, not
  // just an .eq('tenant_id', ...) that a bug could someday drop.
  const supabase = await createAuthServerClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, customer_name, customer_phone, delivery_address, address_detail, delivery_lat, delivery_lng, status, assigned_rider_id, tracking_expired_unresolved, delivery_confirmed_by, review_flag_reason, rider_arrived_at, pending_confirmation_at, created_at, delivered_at"
    )
    .eq("id", id)
    .single();

  if (!order) notFound();

  const { count: orderRank } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .lte("created_at", order.created_at);

  const { data: riders } = await supabase
    .from("riders")
    .select("id, name, phone")
    .eq("active", true)
    .order("name");

  // Tracking tokens have no merchant RLS policy (service-role/token-only
  // resource) -- safe to read via service-role here specifically because
  // `order` was only reachable above through the RLS-authenticated client,
  // which already proved it belongs to this merchant's own tenant.
  const service = createServiceClient();
  const { data: tokens } = await service
    .from("tracking_tokens")
    .select("id, token, type, active, expires_at, revoked_reason, created_at")
    .eq("order_id", id)
    .order("created_at", { ascending: false });

  return (
    <OrderDetail
      order={order}
      orderRank={orderRank ?? 1}
      tokens={tokens ?? []}
      riders={riders ?? []}
      assignEndpoint={`/api/merchant/orders/${id}/assign`}
      backHref="/merchant"
      showCancelAction={false}
      showResetSessionAction={false}
    />
  );
}
