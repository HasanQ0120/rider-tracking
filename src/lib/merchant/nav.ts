export type MerchantNavItem = {
  href: string;
  label: string;
  icon: "orders" | "riders" | "settings" | "account";
};

export type MerchantNavSection = {
  label: string;
  items: MerchantNavItem[];
};

export const MERCHANT_NAV_SECTIONS: MerchantNavSection[] = [
  {
    label: "Operations",
    items: [
      { href: "/merchant/riders", label: "Riders", icon: "riders" },
      { href: "/merchant", label: "Orders", icon: "orders" },
    ],
  },
  {
    label: "Merchant",
    items: [
      { href: "/merchant/settings", label: "Settings", icon: "settings" },
      { href: "/merchant/account", label: "Account", icon: "account" },
    ],
  },
];

/** Flat list for route matching and legacy callers */
export const MERCHANT_NAV: MerchantNavItem[] = MERCHANT_NAV_SECTIONS.flatMap((s) => s.items);

export type MerchantRouteMeta = {
  title: string;
  breadcrumbs: string[];
};

export function merchantRouteMeta(pathname: string): MerchantRouteMeta {
  if (pathname.startsWith("/merchant/orders/") && pathname !== "/merchant/orders/new") {
    return { title: "Order details", breadcrumbs: ["Dashboard", "Orders", "Details"] };
  }
  if (pathname === "/merchant/riders") {
    return { title: "Riders", breadcrumbs: ["Dashboard", "Riders"] };
  }
  if (pathname === "/merchant/settings") {
    return { title: "Settings", breadcrumbs: ["Dashboard", "Settings"] };
  }
  if (pathname === "/merchant/account") {
    return { title: "Account", breadcrumbs: ["Dashboard", "Account"] };
  }
  return { title: "Orders", breadcrumbs: ["Dashboard", "Orders"] };
}
