import Link from "next/link";

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center gap-6 border-b border-brand-navy/10 bg-brand-navy px-6 py-3 text-white">
        <span className="font-semibold">Ops</span>
        <Link href="/ops" className="text-sm hover:underline">
          Orders
        </Link>
        <Link href="/ops/riders" className="text-sm hover:underline">
          Riders
        </Link>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
