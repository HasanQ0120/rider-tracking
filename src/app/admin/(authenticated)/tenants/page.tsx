import { TenantListPanel } from "@/components/admin/TenantListPanel";
import { TENANT_LIST_SELECT } from "@/lib/admin/tenantTypes";
import { createServiceClient } from "@/lib/supabase/service";

export default async function AdminTenantsPage() {
  const service = createServiceClient();
  const { data: tenants } = await service
    .from("tenants")
    .select(TENANT_LIST_SELECT)
    .order("created_at", { ascending: false });

  return <TenantListPanel tenants={tenants ?? []} />;
}
