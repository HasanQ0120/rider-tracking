"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLinkHint } from "@/components/ops/NavLinkHint";

const links = [
  { href: "/ops", label: "Orders" },
  { href: "/ops/riders", label: "Riders" },
];

export function OpsNav() {
  const pathname = usePathname();
  return (
    <>
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-1.5 border-b-2 pb-1 text-sm transition-colors ${
              active
                ? "border-brand-gold text-white"
                : "border-transparent text-white/70 hover:border-white/30 hover:text-white"
            }`}
          >
            {link.label}
            <NavLinkHint />
          </Link>
        );
      })}
    </>
  );
}
