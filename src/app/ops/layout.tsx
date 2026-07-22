import Link from "next/link";
import { OpsNav } from "@/components/ops/OpsNav";
import { NavLinkHint } from "@/components/ops/NavLinkHint";

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-center border-b border-brand-navy/10 bg-brand-navy px-6 py-4 text-white shadow-sm">
        <nav className="flex items-center gap-6">
          <OpsNav />
          <Link
            href="/ops"
            className="flex items-center gap-1.5 font-semibold tracking-wide transition-colors hover:text-white/80"
          >
            Ops
            <NavLinkHint />
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
