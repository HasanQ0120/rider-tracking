import Link from "next/link";
import { OpsNav } from "@/components/ops/OpsNav";
import { LogoutButton } from "@/components/ops/LogoutButton";
import { Logo } from "@/components/ui/Logo";

export default function OpsLayout({ children }: { children: React.ReactNode }) {
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
        <LogoutButton />
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
