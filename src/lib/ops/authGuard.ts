import "server-only";
import { redirect } from "next/navigation";
import { createAuthServerClient } from "@/lib/supabase/serverAuth";
import { createServiceClient } from "@/lib/supabase/service";

export type OpsUser = { id: string; email: string | null };

// Ops accounts are provisioned manually (a service-role insert into
// ops_staff) -- there is no self-service ops signup, so a valid Supabase
// Auth session alone is not sufficient.
export async function requireOpsUser(): Promise<OpsUser> {
  const authClient = await createAuthServerClient();
  const { data } = await authClient.auth.getUser();
  if (!data.user) redirect("/ops/login");

  const service = createServiceClient();
  const { data: staffRow } = await service
    .from("ops_staff")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!staffRow) redirect("/ops/login?error=not_authorized");

  return { id: data.user.id, email: data.user.email ?? null };
}
