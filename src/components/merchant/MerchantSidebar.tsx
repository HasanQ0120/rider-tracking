"use client";

import Link from "next/link";
import type { MerchantNavSection } from "@/lib/merchant/nav";

function NavIcon({ name }: { name: string }) {
  const cls = "h-4 w-4 shrink-0";
  if (name === "dashboard") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 13h7V4H4v9zm9 7h7V11h-7v9zM4 20h7v-5H4v5zm9-16v5h7V4h-7z" />
      </svg>
    );
  }
  if (name === "orders") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    );
  }
  if (name === "riders") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
      </svg>
    );
  }
  if (name === "branches") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3v18" />
        <path d="M12 8c4 0 6-2 7-4" />
        <path d="M12 14c4 0 6 2 7 4" />
        <path d="M12 11c-4 0-6-2-7-4" />
        <path d="M12 17c-4 0-6 2-7 4" />
      </svg>
    );
  }
  if (name === "settings") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );
}

function isActive(href: string, activePath: string) {
  if (href === "/merchant") {
    return activePath === "/merchant";
  }
  return activePath === href || activePath.startsWith(`${href}/`);
}

function readableTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#0f172a" : "#ffffff";
}

export function MerchantSidebar({
  sections,
  activePath,
  primaryColor,
}: {
  sections: MerchantNavSection[];
  activePath: string;
  primaryColor: string;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {section.label}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(item.href, activePath);
                const activeText = readableTextColor(primaryColor);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "shadow-sm"
                        : "text-slate-600 hover:bg-[color-mix(in_srgb,var(--merchant-primary)_8%,white)] hover:text-slate-900"
                    }`}
                    style={
                      active
                        ? {
                            backgroundColor: "var(--merchant-primary)",
                            color: activeText,
                          }
                        : undefined
                    }
                  >
                    {active ? (
                      <span
                        className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full"
                        style={{ backgroundColor: "var(--merchant-secondary)" }}
                      />
                    ) : null}
                    <NavIcon name={item.icon} />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
