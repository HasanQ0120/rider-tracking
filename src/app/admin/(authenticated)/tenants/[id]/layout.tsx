import { notFound } from "next/navigation";
import { TenantWorkspaceShell } from "@/components/admin/TenantWorkspaceShell";
import type { TenantRow } from "@/lib/admin/tenantTypes";
import { serverApi } from "@/lib/api/server";
import axios from "axios";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function TenantWorkspaceLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const api = await serverApi("/admin/login");

  let tenant: TenantRow | null = null;
  try {
    const { data } = await api.get<{ status: string; tenant: TenantRow }>(
      `/api/admin/tenants/${id}`
    );
    tenant = data.tenant ?? null;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) notFound();
    throw err;
  }

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
