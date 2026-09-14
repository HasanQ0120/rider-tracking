import { TenantListPanel } from "@/components/admin/TenantListPanel";
import type { TenantRow } from "@/lib/admin/tenantTypes";
import { serverApi } from "@/lib/api/server";

export default async function AdminTenantsPage() {
  const api = await serverApi("/admin/login");
  const { data } = await api.get<{ status: string; tenants: TenantRow[] }>("/api/admin/tenants");

  return <TenantListPanel tenants={data.tenants ?? []} />;
}
