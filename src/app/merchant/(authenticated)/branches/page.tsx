import { requireMerchantUser } from "@/lib/merchant/authGuard";
import { serverApi } from "@/lib/api/server";
import { MerchantPageHeader } from "@/components/merchant/MerchantUi";
import { BranchesPanel, type BranchRow } from "@/components/merchant/BranchesPanel";

export default async function MerchantBranchesPage() {
  await requireMerchantUser();
  const api = await serverApi("/merchant/login");
  const { data } = await api.get<{ status: string; branches: BranchRow[] }>(
    "/api/merchant/branches"
  );

  return (
    <>
      <MerchantPageHeader
        title="Branches"
        subtitle="Outlets with their own pickup location and dedicated riders. Integrations send branch_id (or external_branch_id) when creating orders."
      />
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <BranchesPanel initialBranches={data.branches ?? []} />
      </div>
    </>
  );
}
