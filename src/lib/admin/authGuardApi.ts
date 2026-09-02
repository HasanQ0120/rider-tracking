import "server-only";
import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/serverAuth";
import { createServiceClient } from "@/lib/supabase/service";

export async function requirePlatformAdminApi(): Promise<
  { user: { id: string } } | { error: NextResponse }
> {
  const authClient = await createAuthServerClient();
  const { data } = await authClient.auth.getUser();
  if (!data.user) {
    return { error: NextResponse.json({ status: "unauthorized" }, { status: 401 }) };
  }

  const service = createServiceClient();
  const { data: adminRow } = await service
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!adminRow) {
    return { error: NextResponse.json({ status: "unauthorized" }, { status: 401 }) };
  }

  return { user: { id: data.user.id } };
}
