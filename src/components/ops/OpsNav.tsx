"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLinkHint } from "@/components/ops/NavLinkHint";

const links = [
  { href: "/ops", label: "Dashboard" },
  { href: "/ops/orders", label: "Orders" },
  { href: "/ops/riders", label: "Riders" },
];

export function OpsNav() {
  const pathname = usePathname();
  return (
    <>
      {links.map((link) => {
        // "/ops" itself must match exactly (it's the Dashboard root); the
        // other two also count as active for their own sub-routes, e.g.
        // /ops/orders/new or /ops/orders/[id].
        const active =
          pathname === link.href ||
          (link.href !== "/ops" && pathname.startsWith(`${link.href}/`));
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
