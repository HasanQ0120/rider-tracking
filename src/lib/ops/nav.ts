export type OpsNavItem = {
  href: string;
  label: string;
  icon: "dashboard" | "orders" | "riders";
};

export type OpsNavSection = {
  label: string;
  items: OpsNavItem[];
};

export const OPS_NAV_SECTIONS: OpsNavSection[] = [
  {
    label: "Operations",
    items: [
      { href: "/ops", label: "Dashboard", icon: "dashboard" },
      { href: "/ops/orders", label: "Orders", icon: "orders" },
      { href: "/ops/riders", label: "Riders", icon: "riders" },
    ],
  },
];

export type OpsRouteMeta = {
  title: string;
  breadcrumbs: string[];
};

export function opsRouteMeta(pathname: string): OpsRouteMeta {
  if (pathname === "/ops/orders/new") {
    return { title: "New order", breadcrumbs: ["Ops", "Orders", "New"] };
  }
  if (pathname.startsWith("/ops/orders/")) {
    return { title: "Order details", breadcrumbs: ["Ops", "Orders", "Details"] };
  }
  if (pathname === "/ops/riders" || pathname.startsWith("/ops/riders/")) {
    return { title: "Riders", breadcrumbs: ["Ops", "Riders"] };
  }
  if (pathname === "/ops/orders") {
    return { title: "Orders", breadcrumbs: ["Ops", "Orders"] };
  }
  return { title: "Dashboard", breadcrumbs: ["Ops", "Dashboard"] };
}
