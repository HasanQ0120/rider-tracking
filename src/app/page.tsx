import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#eef1f6] p-6 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Rider Tracking</h1>
      <p className="max-w-sm text-slate-600">
        Merchants manage deliveries in their portal. Platform admins manage tenants here.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/admin"
          className="rounded-xl bg-[#1e3a5f] px-5 py-3 font-semibold text-white shadow-sm transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
        >
          Admin
        </Link>
        <Link
          href="/merchant/login"
          className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition-all duration-150 hover:bg-slate-50 active:scale-[0.98]"
        >
          Merchant
        </Link>
      </div>
    </div>
  );
}
