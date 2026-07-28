"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLinkHint } from "@/components/ops/NavLinkHint";

const links = [
  { href: "/merchant", label: "Orders" },
  { href: "/merchant/riders", label: "Riders" },
  { href: "/merchant/settings", label: "Settings" },
  { href: "/merchant/account", label: "Account" },
];

export function MerchantNav() {
  const pathname = usePathname();
  return (
    <>
      {links.map((link) => {
        const active =
          pathname === link.href ||
          (link.href !== "/merchant" && pathname.startsWith(`${link.href}/`));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-gold text-brand-navy"
                : "text-white/70 hover:bg-white/5 hover:text-white"
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
