import { AdminSettingsForm } from "@/components/admin/AdminSettingsForm";
import { requirePlatformAdmin } from "@/lib/admin/authGuard";

export default async function AdminSettingsPage() {
  const admin = await requirePlatformAdmin();
  return <AdminSettingsForm email={admin.email} />;
}
