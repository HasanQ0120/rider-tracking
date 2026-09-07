import { notFound } from "next/navigation";
import { TenantWorkspaceShell } from "@/components/admin/TenantWorkspaceShell";
import { TENANT_DETAIL_SELECT } from "@/lib/admin/tenantTypes";
import { createServiceClient } from "@/lib/supabase/service";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function TenantWorkspaceLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const service = createServiceClient();
  const { data: tenant } = await service
    .from("tenants")
    .select(TENANT_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (!tenant) notFound();

  return (
    <TenantWorkspaceShell
      tenant={{
        id: tenant.id,
        name: tenant.name,
        merchant_id: tenant.merchant_id,
        logo_url: tenant.logo_url,
        primary_color: tenant.primary_color,
        secondary_color: tenant.secondary_color,
        active: tenant.active,
        suspended_at: tenant.suspended_at,
      }}
    >
      {children}
    </TenantWorkspaceShell>
  );
}
