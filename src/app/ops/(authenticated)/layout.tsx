import { OpsDashboardShell } from "@/components/ops/OpsDashboardShell";
import { requireOpsUser } from "@/lib/ops/authGuard";

// Every ops page/route already independently calls requireOpsUser() or
// requireOpsUserApi() (verified across the whole ops tree), so this call is
// defense-in-depth, not a fix for a live hole -- but unlike the merchant
// layout (which already guards centrally), this one previously enforced
// nothing itself, leaving protection entirely dependent on every current
// and future ops page remembering to add the check.
export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const ops = await requireOpsUser();
  return <OpsDashboardShell email={ops.email}>{children}</OpsDashboardShell>;
}
