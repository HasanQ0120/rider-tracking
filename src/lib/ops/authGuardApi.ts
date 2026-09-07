import "server-only";
import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/serverAuth";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Accepts platform admins (primary) or legacy ops_staff during the Ops→Admin
 * migration so existing /api/ops/* handlers keep working from the admin UI.
 */
export async function requireOpsUserApi(): Promise<
  { user: { id: string } } | { error: NextResponse }
> {
  const authClient = await createAuthServerClient();
  const { data } = await authClient.auth.getUser();
  if (!data.user) {
    return { error: NextResponse.json({ status: "unauthorized" }, { status: 401 }) };
  }

  const service = createServiceClient();
  const [{ data: adminRow }, { data: staffRow }] = await Promise.all([
    service.from("platform_admins").select("user_id").eq("user_id", data.user.id).maybeSingle(),
    service.from("ops_staff").select("user_id").eq("user_id", data.user.id).maybeSingle(),
  ]);

  if (!adminRow && !staffRow) {
    return { error: NextResponse.json({ status: "unauthorized" }, { status: 401 }) };
  }

  return { user: { id: data.user.id } };
}
