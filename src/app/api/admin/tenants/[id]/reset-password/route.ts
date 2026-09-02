import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/admin/authGuardApi";
import { resetMerchantPassword } from "@/lib/admin/provisionTenant";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const guard = await requirePlatformAdminApi();
  if ("error" in guard) return guard.error;

  const { id } = await context.params;

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.password) {
    return NextResponse.json({ status: "error", message: "password is required." }, { status: 400 });
  }

  const result = await resetMerchantPassword(id, body.password);
  if (!result.ok) {
    return NextResponse.json({ status: "error", message: result.error }, { status: 400 });
  }

  return NextResponse.json({ status: "ok" });
}
