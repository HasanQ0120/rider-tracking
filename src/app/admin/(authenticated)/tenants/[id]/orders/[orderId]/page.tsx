import { notFound } from "next/navigation";
import { OrderDetail } from "@/components/ops/OrderDetail";
import { serverApi } from "@/lib/api/server";
import axios from "axios";

type PageProps = { params: Promise<{ id: string; orderId: string }> };

export default async function TenantOrderDetailPage({ params }: PageProps) {
  const { id: tenantId, orderId } = await params;
  const api = await serverApi("/admin/login");

  try {
    const { data } = await api.get<{
      status: string;
      order: Parameters<typeof OrderDetail>[0]["order"];
      order_rank: number;
      tokens: Parameters<typeof OrderDetail>[0]["tokens"];
      pin: string | null;
      riders: Parameters<typeof OrderDetail>[0]["riders"];
    }>(`/api/admin/tenants/${tenantId}/orders/${orderId}`);

    if (!data.order) notFound();

    return (
      <OrderDetail
        order={data.order}
        orderRank={data.order_rank ?? 1}
        tokens={data.tokens ?? []}
        riders={data.riders ?? []}
        pin={data.pin ?? null}
        assignEndpoint={`/api/ops/orders/${orderId}/assign`}
        resetSessionEndpoint={`/api/ops/orders/${orderId}/reset-session`}
        cancelEndpoint={`/api/ops/orders/${orderId}/cancel`}
        backHref={`/admin/tenants/${tenantId}/orders`}
        showCancelAction
        showResetSessionAction
        showRiderLinks
      />
    );
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) notFound();
    throw err;
  }
}
