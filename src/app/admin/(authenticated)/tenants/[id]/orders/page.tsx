import { notFound } from "next/navigation";
import { MerchantContentCard } from "@/components/merchant/MerchantUi";
import { OrdersTable } from "@/components/ops/OrdersTable";
import { serverApi } from "@/lib/api/server";
import axios from "axios";

type PageProps = { params: Promise<{ id: string }> };

export default async function TenantOrdersPage({ params }: PageProps) {
  const { id } = await params;
  const api = await serverApi("/admin/login");

  try {
    const { data } = await api.get<{ status: string; orders: Parameters<typeof OrdersTable>[0]["orders"] }>(
      `/api/admin/tenants/${id}/orders`
    );

    return (
      <MerchantContentCard
        title="Orders"
        subtitle="View and manage this merchant's deliveries. New orders come from Merchant / API only."
      >
        <OrdersTable
          orders={data.orders ?? []}
          orderBasePath={`/admin/tenants/${id}/orders`}
          variant="light"
        />
      </MerchantContentCard>
    );
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) notFound();
    throw err;
  }
}
