import { notFound } from "next/navigation";
import { TenantOverviewPanel } from "@/components/admin/TenantOverviewPanel";
import type { TenantRow } from "@/lib/admin/tenantTypes";
import { serverApi } from "@/lib/api/server";
import axios from "axios";

type PageProps = { params: Promise<{ id: string }> };

export default async function TenantOverviewPage({ params }: PageProps) {
  const { id } = await params;
  const api = await serverApi("/admin/login");

  try {
    const { data } = await api.get<{
      status: string;
      tenant: TenantRow;
      stats: {
        orderCount: number;
        riderCount: number;
        activeOrders: number;
        flaggedOrders: number;
      };
    }>(`/api/admin/tenants/${id}`);

    if (!data.tenant) notFound();

    return (
      <TenantOverviewPanel
        tenant={data.tenant}
        stats={
          data.stats ?? {
            orderCount: 0,
            riderCount: 0,
            activeOrders: 0,
            flaggedOrders: 0,
          }
        }
      />
    );
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) notFound();
    throw err;
  }
}
