import { NextResponse } from "next/server";
import { normalizeIntegrationSource, requireV1ApiKey } from "@/lib/tenant/v1Api";
import { performRiderAssignment } from "@/lib/assignRider";
import { customerTrackingUrl } from "@/lib/appUrl";
import { getActiveCustomerToken } from "@/lib/trackingTokens";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Assign (or reassign) a rider from the merchant's own system
 * (Golootlo Order Portal, POS, website) using the tenant API key.
 *
 * Body: { rider_id, confirm_reassign?, source? }
 */
export async function POST(req: Request, context: RouteContext) {
  const guard = await requireV1ApiKey(req);
  if ("error" in guard) return guard.error;
  const { tenant, service } = guard;
  const { id: orderId } = await context.params;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const riderId = (body as { rider_id?: string; riderId?: string }).rider_id
    ?? (body as { riderId?: string }).riderId;
  const confirmReassign = Boolean(
    (body as { confirm_reassign?: boolean; confirmReassign?: boolean }).confirm_reassign
      ?? (body as { confirmReassign?: boolean }).confirmReassign
  );
  const sourceRaw = (body as { source?: unknown }).source;
  const normalizedSource = normalizeIntegrationSource(sourceRaw);
  if (sourceRaw != null && sourceRaw !== "" && !normalizedSource) {
    return NextResponse.json({ status: "invalid_source" }, { status: 400 });
  }

  if (!riderId || typeof riderId !== "string") {
    return NextResponse.json({ status: "invalid_request", message: "rider_id is required." }, { status: 400 });
  }

  const { data: order } = await service
    .from("orders")
    .select("id, tenant_id, status, assigned_rider_id, customer_name, customer_phone")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.tenant_id !== tenant.id) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }
  if (order.status === "delivered" || order.status === "cancelled") {
    return NextResponse.json({ status: "order_closed" }, { status: 409 });
  }

  const { data: rider } = await service
    .from("riders")
    .select("id, tenant_id, name, phone, active")
    .eq("id", riderId)
    .maybeSingle();

  if (!rider || rider.tenant_id !== tenant.id || !rider.active) {
    return NextResponse.json({ status: "rider_not_found" }, { status: 404 });
  }

  const isReassignment = Boolean(order.assigned_rider_id);
  if (isReassignment && !confirmReassign) {
    return NextResponse.json({ status: "needs_confirmation" }, { status: 409 });
  }

  try {
    const result = await performRiderAssignment(service, {
      orderId,
      riderId: rider.id,
      riderPhone: rider.phone,
      customerPhone: order.customer_phone,
      customerName: order.customer_name,
      isReassignment,
    });

    if (normalizedSource) {
      await service.from("orders").update({ source: normalizedSource }).eq("id", orderId);
    }

    const customerToken =
      result.customerTrackingToken ?? (await getActiveCustomerToken(service, orderId));

    const { data: finalOrder } = await service.from("orders").select().eq("id", orderId).single();

    return NextResponse.json({
      status: "ok",
      order: finalOrder,
      assignedRider: { id: rider.id, name: rider.name },
      customer_tracking_url: customerToken ? customerTrackingUrl(customerToken) : null,
    });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
