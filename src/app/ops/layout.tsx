import { OpsNav } from "@/components/ops/OpsNav";

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center gap-6 border-b border-brand-navy/10 bg-brand-navy px-6 py-4 text-white shadow-sm">
        <span className="font-semibold tracking-wide">Ops</span>
        <nav className="flex items-center gap-6">
          <OpsNav />
        </nav>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
