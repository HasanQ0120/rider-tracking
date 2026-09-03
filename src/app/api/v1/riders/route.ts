import { NextResponse } from "next/server";
import { requireV1ApiKey } from "@/lib/tenant/v1Api";
import { validateRiderFields, type ParsedRider } from "@/lib/riderValidation";
import { buildRiderInsertRows } from "@/lib/rider/insertRows";
import { sendAvailabilityLink } from "@/lib/notify";

const RIDER_LIST_SELECT =
  "id, name, phone, active, available, license_plate, created_at";

/**
 * List this tenant's riders for merchant systems (Golootlo portal / POS dropdown).
 * Query: ?active=true|false (optional), ?available=true|false (optional)
 */
export async function GET(req: Request) {
  const guard = await requireV1ApiKey(req);
  if ("error" in guard) return guard.error;
  const { tenant, service } = guard;

  const url = new URL(req.url);
  const activeParam = url.searchParams.get("active");
  const availableParam = url.searchParams.get("available");

  let query = service
    .from("riders")
    .select(RIDER_LIST_SELECT)
    .eq("tenant_id", tenant.id)
    .order("name", { ascending: true });

  if (activeParam === "true") query = query.eq("active", true);
  if (activeParam === "false") query = query.eq("active", false);
  if (availableParam === "true") query = query.eq("available", true);
  if (availableParam === "false") query = query.eq("available", false);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", riders: data ?? [] });
}

export async function POST(req: Request) {
  const guard = await requireV1ApiKey(req);
  if ("error" in guard) return guard.error;
  const { tenant, service } = guard;

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
