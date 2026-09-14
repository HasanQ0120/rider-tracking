export type AdminNavItem = {
  href: string;
  label: string;
  icon: "dashboard" | "tenants" | "settings";
};

export type AdminNavSection = {
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    label: "Platform",
    items: [
      { href: "/admin", label: "Dashboard", icon: "dashboard" },
      { href: "/admin/tenants", label: "Tenants", icon: "tenants" },
      { href: "/admin/settings", label: "Settings", icon: "settings" },
    ],
  },
];

export type AdminRouteMeta = {
  title: string;
  breadcrumbs: string[];
};

export function adminRouteMeta(pathname: string): AdminRouteMeta {
  if (pathname === "/admin/settings") {
    return { title: "Settings", breadcrumbs: ["Admin", "Settings"] };
  }
  if (pathname === "/admin/tenants/new") {
    return { title: "Add tenant", breadcrumbs: ["Admin", "Tenants", "New"] };
  }
  if (pathname.match(/^\/admin\/tenants\/[^/]+\/orders(\/|$)/)) {
    return { title: "Tenant orders", breadcrumbs: ["Admin", "Tenants", "Orders"] };
  }
  if (pathname.match(/^\/admin\/tenants\/[^/]+\/riders/)) {
    return { title: "Tenant riders", breadcrumbs: ["Admin", "Tenants", "Riders"] };
  }
  if (pathname.match(/^\/admin\/tenants\/[^/]+\/branches/)) {
    return { title: "Tenant branches", breadcrumbs: ["Admin", "Tenants", "Branches"] };
  }
  if (pathname.match(/^\/admin\/tenants\/[^/]+\/branding/)) {
    return { title: "Tenant branding", breadcrumbs: ["Admin", "Tenants", "Branding"] };
  }
  if (pathname.match(/^\/admin\/tenants\/[^/]+$/)) {
    return { title: "Tenant overview", breadcrumbs: ["Admin", "Tenants", "Overview"] };
  }
  if (pathname === "/admin/tenants" || pathname.startsWith("/admin/tenants/")) {
    return { title: "Tenants", breadcrumbs: ["Admin", "Tenants"] };
  }
  return { title: "Dashboard", breadcrumbs: ["Admin", "Dashboard"] };
}

export type TenantTabId = "overview" | "orders" | "riders" | "branches" | "branding";

export function tenantTabs(tenantId: string): { id: TenantTabId; href: string; label: string }[] {
  const base = `/admin/tenants/${tenantId}`;
  return [
    { id: "overview", href: base, label: "Overview" },
    { id: "orders", href: `${base}/orders`, label: "Orders" },
    { id: "riders", href: `${base}/riders`, label: "Riders" },
    { id: "branches", href: `${base}/branches`, label: "Branches" },
    { id: "branding", href: `${base}/branding`, label: "Branding" },
  ];
}

export function activeTenantTab(pathname: string, tenantId: string): TenantTabId {
  const base = `/admin/tenants/${tenantId}`;
  if (pathname.startsWith(`${base}/orders`)) return "orders";
  if (pathname.startsWith(`${base}/riders`)) return "riders";
  if (pathname.startsWith(`${base}/branches`)) return "branches";
  if (pathname.startsWith(`${base}/branding`)) return "branding";
  return "overview";
}
