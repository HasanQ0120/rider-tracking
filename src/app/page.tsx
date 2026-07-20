import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white p-6 text-center">
      <h1 className="text-2xl font-semibold text-brand-navy">Rider Tracking</h1>
      <p className="max-w-sm text-brand-navy/70">
        Rider and customer tracking pages are opened directly from their SMS links. Ops staff
        manage orders and riders here.
      </p>
      <Link
        href="/ops"
        className="rounded-xl bg-brand-navy px-5 py-3 font-semibold text-white hover:bg-brand-navy/90"
      >
        Go to Ops Panel
      </Link>
    </div>
  );
}
