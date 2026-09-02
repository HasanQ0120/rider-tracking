import { AdminShell } from "@/components/admin/AdminShell";
import { requirePlatformAdmin } from "@/lib/admin/authGuard";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();
  return <AdminShell email={admin.email}>{children}</AdminShell>;
}
