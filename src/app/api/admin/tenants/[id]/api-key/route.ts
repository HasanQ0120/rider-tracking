import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/admin/authGuardApi";
import { createServiceClient } from "@/lib/supabase/service";
import { generateApiKey, hashPin } from "@/lib/tokens";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const guard = await requirePlatformAdminApi();
  if ("error" in guard) return guard.error;

  const { id } = await context.params;
  const { key, prefix } = generateApiKey();
  const hash = await hashPin(key);

  const service = createServiceClient();
  const { data, error } = await service
    .from("tenants")
    .update({ api_key_hash: hash, api_key_prefix: prefix })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ status: "error", message: "Tenant not found." }, { status: 404 });
  }

  return NextResponse.json({ status: "ok", apiKey: key, prefix });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await requirePlatformAdminApi();
  if ("error" in guard) return guard.error;

  const { id } = await context.params;
  const service = createServiceClient();
  const { data, error } = await service
    .from("tenants")
    .update({ api_key_hash: null, api_key_prefix: null })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ status: "error", message: "Tenant not found." }, { status: 404 });
  }

  return NextResponse.json({ status: "ok" });
}
