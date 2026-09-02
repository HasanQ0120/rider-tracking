"use client";

import Link from "next/link";

const SECTIONS = [
  { id: "brand-appearance", label: "Brand appearance" },
  { id: "pickup-location", label: "Pickup location" },
  { id: "automatic-assignment", label: "Automatic assignment" },
  { id: "api-access", label: "API access" },
];

export function MerchantSettingsSidebar({ gpsLostCount }: { gpsLostCount?: number }) {
  return (
    <div className="space-y-4 lg:sticky lg:top-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">On this page</p>
        <ul className="space-y-1">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="block rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {gpsLostCount && gpsLostCount > 0 ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-blue-900">
            {gpsLostCount} issue{gpsLostCount === 1 ? "" : "s"} to fix
          </p>
          <p className="mt-1 text-sm text-blue-800/80">
            {gpsLostCount} rider{gpsLostCount === 1 ? "" : "s"} not reporting GPS in the last 10 minutes.
          </p>
          <Link
            href="/merchant/riders"
            className="mt-3 inline-block text-sm font-semibold text-[var(--merchant-accent,#0b4da2)] hover:underline"
          >
            Review riders →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
