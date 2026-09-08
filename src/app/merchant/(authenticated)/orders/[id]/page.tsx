import { requireMerchantUser } from "@/lib/merchant/authGuard";
import { serverApi } from "@/lib/api/server";
import { OrderDetail } from "@/components/ops/OrderDetail";
import { notFound } from "next/navigation";
import axios from "axios";

export default async function MerchantOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireMerchantUser();
  const { id } = await params;
  const api = await serverApi("/merchant/login");

  try {
    const { data } = await api.get<{
      status: string;
      order: Parameters<typeof OrderDetail>[0]["order"];
      order_rank: number;
      tokens: Parameters<typeof OrderDetail>[0]["tokens"];
      pin: string | null;
      riders: Parameters<typeof OrderDetail>[0]["riders"];
    }>(`/api/merchant/orders/${id}`);

    if (!data.order) notFound();

    return (
      <OrderDetail
        order={data.order}
        orderRank={data.order_rank ?? 1}
        tokens={data.tokens ?? []}
        riders={data.riders ?? []}
        pin={data.pin ?? null}
        assignEndpoint={`/api/merchant/orders/${id}/assign`}
        backHref="/merchant"
        showCancelAction={false}
        showResetSessionAction={false}
        showRiderLinks={false}
        merchantMode
      />
    );
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) notFound();
    throw err;
  }
}
