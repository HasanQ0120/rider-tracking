import "server-only";
import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/serverAuth";
import { createServiceClient } from "@/lib/supabase/service";

// API-route variant of requireOpsUser(): returns a 401 JSON response
// instead of redirect()-ing, since these routes are called via fetch()
// from client components, not rendered as pages.
export async function requireOpsUserApi(): Promise<
  { user: { id: string } } | { error: NextResponse }
> {
  const authClient = await createAuthServerClient();
  const { data } = await authClient.auth.getUser();
  if (!data.user) {
    return { error: NextResponse.json({ status: "unauthorized" }, { status: 401 }) };
  }

  const service = createServiceClient();
  const { data: staffRow } = await service
    .from("ops_staff")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!staffRow) {
    return { error: NextResponse.json({ status: "unauthorized" }, { status: 401 }) };
  }

  return { user: { id: data.user.id } };
}
