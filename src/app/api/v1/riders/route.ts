import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveTenantByApiKey } from "@/lib/tenant/resolveApiKey";
import { validateRiderFields } from "@/lib/riderValidation";
import { generateDutyToken } from "@/lib/tokens";

// Same auth/rate-limit shape as /api/v1/orders -- a merchant's own backend
// calls this directly to register/sync riders (e.g. their existing ~100-
// rider roster) instead of manual entry or a one-off CSV upload.
const MIN_INTERVAL_MS = 500;
const lastRequestByTenant = new Map<string, number>();

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const rawKey = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null;

  const service = createServiceClient();
  const tenant = await resolveTenantByApiKey(service, rawKey);
  if (!tenant) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const lastForTenant = lastRequestByTenant.get(tenant.id) ?? 0;
  if (now - lastForTenant < MIN_INTERVAL_MS) {
    return NextResponse.json({ status: "rate_limited" }, { status: 429 });
  }
  lastRequestByTenant.set(tenant.id, now);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  // Accepts a batch ({ riders: [...] }) or a single rider object directly --
  // registering just one rider shouldn't require wrapping it in an array.
  const inputRiders: unknown[] = Array.isArray((body as Record<string, unknown>).riders)
    ? (body as Record<string, unknown>).riders as unknown[]
    : "name" in body || "phone" in body
      ? [body]
      : [];

  if (inputRiders.length === 0) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const valid: { name: string; phone: string; license_plate: string }[] = [];
  const errors: { index: number; reason: string }[] = [];

  inputRiders.forEach((item, index) => {
    if (typeof item !== "object" || item === null) {
      errors.push({ index, reason: "Invalid rider entry" });
      return;
    }
    const result = validateRiderFields(item as Record<string, unknown>);
    if (!result.ok) {
      errors.push({ index, reason: result.reason });
      return;
    }
    valid.push(result.rider);
  });

  if (valid.length === 0) {
    return NextResponse.json({ status: "ok", imported: 0, riders: [], errors });
  }

  // New riders are off duty by default with zero extra code -- they simply
  // have no rider_duty_locations row until they check in via their own
  // duty link, which is what "on duty" already means everywhere else.
  const { data, error } = await service
    .from("riders")
    .insert(
      valid.map((r) => ({
        tenant_id: tenant.id,
        name: r.name,
        phone: r.phone,
        license_plate: r.license_plate,
        duty_token: generateDutyToken(),
      }))
    )
    .select();

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });
  return NextResponse.json({ status: "ok", imported: data?.length ?? 0, riders: data, errors });
}
