import { notFound } from "next/navigation";
import axios from "axios";
import { BranchesPanel, type BranchRow } from "@/components/merchant/BranchesPanel";
import { serverApi } from "@/lib/api/server";

type PageProps = { params: Promise<{ id: string }> };

export default async function TenantBranchesPage({ params }: PageProps) {
  const { id } = await params;
  const api = await serverApi("/admin/login");

  try {
    const { data } = await api.get<{ status: string; branches: BranchRow[] }>(
      `/api/admin/tenants/${id}/branches`
    );

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <BranchesPanel
          initialBranches={data.branches ?? []}
          listEndpoint={`/api/admin/tenants/${id}/branches`}
          bulkEndpoint={`/api/admin/tenants/${id}/branches/bulk`}
        />
      </div>
    );
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) notFound();
    throw err;
  }
}
