import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveTenantByApiKey } from "@/lib/tenant/resolveApiKey";
import { validateRiderFields, type ParsedRider } from "@/lib/riderValidation";
import { buildRiderInsertRows } from "@/lib/rider/insertRows";
import { sendAvailabilityLink } from "@/lib/notify";

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

  const inputRiders: unknown[] = Array.isArray((body as Record<string, unknown>).riders)
    ? ((body as Record<string, unknown>).riders as unknown[])
    : "name" in body || "phone" in body
      ? [body]
      : [];

  if (inputRiders.length === 0) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const valid: ParsedRider[] = [];
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

  const withTokens = await buildRiderInsertRows(tenant.id, valid);

  const { data, error } = await service.from("riders").insert(withTokens).select();

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });
  await Promise.all(withTokens.map((r) => sendAvailabilityLink(r.phone, r.availability_token)));
  return NextResponse.json({ status: "ok", imported: data?.length ?? 0, riders: data, errors });
}
