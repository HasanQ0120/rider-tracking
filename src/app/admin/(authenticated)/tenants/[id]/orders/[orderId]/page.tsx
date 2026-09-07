import { notFound } from "next/navigation";
import { OrderDetail } from "@/components/ops/OrderDetail";
import { createServiceClient } from "@/lib/supabase/service";

type PageProps = { params: Promise<{ id: string; orderId: string }> };

export default async function TenantOrderDetailPage({ params }: PageProps) {
  const { id: tenantId, orderId } = await params;
  const service = createServiceClient();

  const { data: order } = await service
    .from("orders")
    .select(
      "id, customer_name, customer_phone, delivery_address, address_detail, delivery_lat, delivery_lng, status, assigned_rider_id, tracking_expired_unresolved, delivery_confirmed_by, review_flag_reason, rider_arrived_at, pending_confirmation_at, created_at, delivered_at, tenant_id"
    )
    .eq("id", orderId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!order) notFound();

  const { count: orderRank } = await service
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .lte("created_at", order.created_at);

  const { data: tokens } = await service
    .from("tracking_tokens")
    .select("id, token, type, active, expires_at, revoked_reason, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  const activeRiderTokenId = tokens?.find((t) => t.type === "rider" && t.active)?.id;
  const { data: pinCode } = activeRiderTokenId
    ? await service
        .from("pin_codes")
        .select("pin_plain")
        .eq("rider_token_id", activeRiderTokenId)
        .maybeSingle()
    : { data: null };

  const { data: riders } = await service
    .from("riders")
    .select("id, name, phone")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("name");

  return (
    <OrderDetail
      order={order}
      orderRank={orderRank ?? 1}
      tokens={tokens ?? []}
      riders={riders ?? []}
      pin={pinCode?.pin_plain ?? null}
      assignEndpoint={`/api/ops/orders/${orderId}/assign`}
      resetSessionEndpoint={`/api/ops/orders/${orderId}/reset-session`}
      cancelEndpoint={`/api/ops/orders/${orderId}/cancel`}
      backHref={`/admin/tenants/${tenantId}/orders`}
      showCancelAction
      showResetSessionAction
      showRiderLinks
    />
  );
}
