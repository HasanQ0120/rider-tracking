import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/admin/authGuardApi";
import { provisionTenant } from "@/lib/admin/provisionTenant";
import { TENANT_LIST_SELECT } from "@/lib/admin/tenantTypes";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const guard = await requirePlatformAdminApi();
  if ("error" in guard) return guard.error;

  const service = createServiceClient();
  const { data, error } = await service
    .from("tenants")
    .select(TENANT_LIST_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", tenants: data ?? [] });
}

export async function POST(request: Request) {
  const guard = await requirePlatformAdminApi();
  if ("error" in guard) return guard.error;

  let body: {
    merchantId?: string;
    name?: string;
    password?: string;
    contactEmail?: string | null;
    generateApiKey?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.merchantId || !body.name || !body.password) {
    return NextResponse.json(
      { status: "error", message: "merchantId, name, and password are required." },
      { status: 400 }
    );
  }

  const result = await provisionTenant({
    merchantId: body.merchantId,
    name: body.name,
    password: body.password,
    contactEmail: body.contactEmail,
    generateApiKeyOnCreate: body.generateApiKey === true,
  });

  if (!result.ok) {
    return NextResponse.json({ status: "error", message: result.error }, { status: 400 });
  }

  return NextResponse.json({
    status: "ok",
    tenantId: result.tenantId,
    merchantId: result.merchantId,
    apiKey: result.apiKey,
    apiKeyPrefix: result.apiKeyPrefix,
  });
}
