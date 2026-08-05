import Link from "next/link";
import { OpsNav } from "@/components/ops/OpsNav";
import { LogoutButton } from "@/components/ops/LogoutButton";
import { Logo } from "@/components/ui/Logo";
import { ViewBadge } from "@/components/ui/ViewBadge";
import { requireOpsUser } from "@/lib/ops/authGuard";

// Every ops page/route already independently calls requireOpsUser() or
// requireOpsUserApi() (verified across the whole ops tree), so this call is
// defense-in-depth, not a fix for a live hole -- but unlike the merchant
// layout (which already guards centrally), this one previously enforced
// nothing itself, leaving protection entirely dependent on every current
// and future ops page remembering to add the check.
export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  await requireOpsUser();
  return (
    <div className="min-h-screen bg-surface">
      <header className="flex items-center justify-between border-b border-white/10 bg-[#070a12] px-6 py-3 text-white shadow-sm">
        <Link href="/ops" className="flex items-center gap-2.5">
          <Logo size={32} />
          <span className="flex items-baseline gap-1.5">
            <span className="font-semibold tracking-wide">Rider Tracking</span>
            <span className="text-xs text-white/50">Ops</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <OpsNav />
        </nav>
        <div className="flex items-center gap-3">
          <ViewBadge label="Ops View" />
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
