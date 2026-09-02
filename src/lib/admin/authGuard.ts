import "server-only";
import { redirect } from "next/navigation";
import { createAuthServerClient } from "@/lib/supabase/serverAuth";
import { createServiceClient } from "@/lib/supabase/service";

export type PlatformAdmin = { id: string; email: string | null };

// Platform admin accounts are provisioned manually (service-role insert
// into platform_admins) — a valid Supabase Auth session alone is not enough.
export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const authClient = await createAuthServerClient();
  const { data } = await authClient.auth.getUser();
  if (!data.user) redirect("/admin/login");

  const service = createServiceClient();
  const { data: adminRow } = await service
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!adminRow) redirect("/admin/login?error=not_authorized");

  return { id: data.user.id, email: data.user.email ?? null };
}
