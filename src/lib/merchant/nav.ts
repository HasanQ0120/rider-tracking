export type MerchantNavItem = {
  href: string;
  label: string;
  icon: "orders" | "riders" | "branches" | "settings" | "account" | "dashboard";
};

export type MerchantNavSection = {
  label: string;
  items: MerchantNavItem[];
};

export const MERCHANT_NAV_SECTIONS: MerchantNavSection[] = [
  {
    label: "Operations",
    items: [
      { href: "/merchant", label: "Dashboard", icon: "dashboard" },
      { href: "/merchant/orders", label: "Orders", icon: "orders" },
      { href: "/merchant/riders", label: "Riders", icon: "riders" },
      { href: "/merchant/branches", label: "Branches", icon: "branches" },
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
    return { title: "Order details", breadcrumbs: ["Merchant", "Orders", "Details"] };
  }
  if (pathname === "/merchant/orders/new") {
    return { title: "New order", breadcrumbs: ["Merchant", "Orders", "New"] };
  }
  if (pathname === "/merchant/orders") {
    return { title: "Orders", breadcrumbs: ["Merchant", "Orders"] };
  }
  if (pathname === "/merchant/riders") {
    return { title: "Riders", breadcrumbs: ["Merchant", "Riders"] };
  }
  if (pathname === "/merchant/branches") {
    return { title: "Branches", breadcrumbs: ["Merchant", "Branches"] };
  }
  if (pathname === "/merchant/settings") {
    return { title: "Settings", breadcrumbs: ["Merchant", "Settings"] };
  }
  if (pathname === "/merchant/account") {
    return { title: "Account", breadcrumbs: ["Merchant", "Account"] };
  }
  return { title: "Dashboard", breadcrumbs: ["Merchant", "Dashboard"] };
}
