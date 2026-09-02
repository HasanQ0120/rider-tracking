import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/admin/authGuardApi";
import { TENANT_DETAIL_SELECT } from "@/lib/admin/tenantTypes";
import { validateTenantName } from "@/lib/admin/tenantValidation";
import { isValidHexColor } from "@/lib/merchant/branding";
import { createServiceClient } from "@/lib/supabase/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const guard = await requirePlatformAdminApi();
  if ("error" in guard) return guard.error;

  const { id } = await context.params;
  const service = createServiceClient();
  const { data, error } = await service
    .from("tenants")
    .select(TENANT_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ status: "error", message: "Tenant not found." }, { status: 404 });
  }

  return NextResponse.json({ status: "ok", tenant: data });
}

export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requirePlatformAdminApi();
  if ("error" in guard) return guard.error;

  const { id } = await context.params;

  let body: {
    name?: string;
    contactEmail?: string | null;
    active?: boolean;
    suspended?: boolean;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    webhookUrl?: string | null;
    autoAssignEnabled?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid JSON body." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const nameError = validateTenantName(body.name);
    if (nameError) {
      return NextResponse.json({ status: "error", message: nameError }, { status: 400 });
    }
    updates.name = body.name.trim();
  }

  if (body.contactEmail !== undefined) {
    updates.contact_email = body.contactEmail?.trim() || null;
  }

  if (body.active !== undefined) {
    updates.active = body.active;
  }

  if (body.suspended !== undefined) {
    updates.suspended_at = body.suspended ? new Date().toISOString() : null;
    updates.active = !body.suspended;
  }

  if (body.primaryColor !== undefined) {
    if (!isValidHexColor(body.primaryColor)) {
      return NextResponse.json({ status: "error", message: "Invalid primary color." }, { status: 400 });
    }
    updates.primary_color = body.primaryColor;
  }

  if (body.secondaryColor !== undefined) {
    if (!isValidHexColor(body.secondaryColor)) {
      return NextResponse.json({ status: "error", message: "Invalid secondary color." }, { status: 400 });
    }
    updates.secondary_color = body.secondaryColor;
  }

  if (body.accentColor !== undefined) {
    if (!isValidHexColor(body.accentColor)) {
      return NextResponse.json({ status: "error", message: "Invalid accent color." }, { status: 400 });
    }
    updates.accent_color = body.accentColor;
  }

  if (body.webhookUrl !== undefined) {
    updates.webhook_url = body.webhookUrl?.trim() || null;
  }

  if (body.autoAssignEnabled !== undefined) {
    updates.auto_assign_enabled = body.autoAssignEnabled;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ status: "error", message: "No fields to update." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("tenants")
    .update(updates)
    .eq("id", id)
    .select(TENANT_DETAIL_SELECT)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ status: "error", message: "Tenant not found." }, { status: 404 });
  }

  return NextResponse.json({ status: "ok", tenant: data });
}
