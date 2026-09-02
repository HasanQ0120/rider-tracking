import { notFound } from "next/navigation";
import { TenantDetailPanel } from "@/components/admin/TenantDetailPanel";
import { TENANT_DETAIL_SELECT } from "@/lib/admin/tenantTypes";
import { createServiceClient } from "@/lib/supabase/service";

type PageProps = { params: Promise<{ id: string }> };

export default async function TenantDetailPage({ params }: PageProps) {
  const { id } = await params;
  const service = createServiceClient();
  const { data: tenant } = await service
    .from("tenants")
    .select(TENANT_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (!tenant) notFound();

  return <TenantDetailPanel tenant={tenant} />;
}
