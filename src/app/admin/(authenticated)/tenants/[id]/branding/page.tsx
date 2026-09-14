import { notFound } from "next/navigation";
import { TenantBrandingPanel } from "@/components/admin/TenantBrandingPanel";
import type { TenantRow } from "@/lib/admin/tenantTypes";
import { serverApi } from "@/lib/api/server";
import axios from "axios";

type PageProps = { params: Promise<{ id: string }> };

export default async function TenantBrandingPage({ params }: PageProps) {
  const { id } = await params;
  const api = await serverApi("/admin/login");

  try {
    const { data } = await api.get<{ status: string; tenant: TenantRow }>(
      `/api/admin/tenants/${id}`
    );
    if (!data.tenant) notFound();
    return <TenantBrandingPanel tenant={data.tenant} />;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) notFound();
    throw err;
  }
}
