import { NextResponse } from "next/server";
import { requireRiderApi } from "@/lib/riderApp/authGuardApi";

export async function GET(req: Request) {
  const auth = await requireRiderApi(req);
  if ("error" in auth) return auth.error;

  return NextResponse.json({ status: "ok", available: auth.rider.available });
}

export async function PATCH(req: Request) {
  const auth = await requireRiderApi(req);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.available !== "boolean") {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("riders")
    .update({ available: body.available })
    .eq("id", auth.riderId)
    .eq("tenant_id", auth.tenantId)
    .select("available")
    .single();

  if (error || !data) {
    console.error("[rider-app/availability] update failed", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", available: data.available });
}
