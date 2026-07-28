import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveTenantByApiKey } from "@/lib/tenant/resolveApiKey";
import { runAutoAssignment } from "@/lib/autoAssign";
import { cleanPhoneInput, isValidPakistaniMobile } from "@/lib/phone";

// The one genuinely public-facing, credential-only endpoint in the app --
// a merchant's own backend calls this directly, no browser session
// involved. In-memory sliding window per tenant (same pattern as
// /api/geocode's per-IP one) -- resets on restart, doesn't share state
// across instances, which is fine for the traffic this is meant to absorb
// (a merchant's own order-creation calls, not public scraping).
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
  if (!body) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }
  const {
    customer_name,
    customer_phone,
    delivery_address,
    delivery_lat,
    delivery_lng,
    address_detail,
    pickup_lat,
    pickup_lng,
  } = body;

  if (!customer_name || !customer_phone || !delivery_address) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }
  if (!isValidPakistaniMobile(customer_phone)) {
    return NextResponse.json({ status: "invalid_phone" }, { status: 400 });
  }
  if ((pickup_lat == null) !== (pickup_lng == null)) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  // Recorded on the order itself (not just used transiently) so a
  // multi-branch merchant's per-order pickup point stays auditable even if
  // their tenant-wide default changes later.
  const resolvedPickupLat = pickup_lat ?? tenant.defaultPickupLat;
  const resolvedPickupLng = pickup_lng ?? tenant.defaultPickupLng;

  const { data: order, error } = await service
    .from("orders")
    .insert({
      tenant_id: tenant.id,
      customer_name,
      customer_phone: cleanPhoneInput(customer_phone),
      delivery_address,
      delivery_lat: delivery_lat ?? null,
      delivery_lng: delivery_lng ?? null,
      address_detail: address_detail?.trim() || null,
      pickup_lat: resolvedPickupLat ?? null,
      pickup_lng: resolvedPickupLng ?? null,
    })
    .select()
    .single();

  if (error || !order) {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  const assignment =
    resolvedPickupLat != null && resolvedPickupLng != null
      ? await runAutoAssignment(service, tenant.id, order.id, {
          lat: resolvedPickupLat,
          lng: resolvedPickupLng,
        })
      : null;

  const { data: finalOrder } = await service.from("orders").select().eq("id", order.id).single();

  return NextResponse.json({
    status: "ok",
    order: finalOrder ?? order,
    assignedRider: assignment ? { id: assignment.riderId, name: assignment.riderName } : null,
  });
}
