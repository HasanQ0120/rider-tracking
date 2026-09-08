import "server-only";
import { redirect } from "next/navigation";
import { getVerifiedPortalSession } from "@/lib/api/session";

export type PlatformAdmin = { id: string; email: string | null };

export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const session = await getVerifiedPortalSession();
  if (!session) redirect("/admin/login");
  if (session.role !== "platform_admin") {
    redirect("/admin/login?error=not_authorized");
  }
  return { id: session.userId, email: session.email };
}
