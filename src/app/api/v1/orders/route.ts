import { NextResponse } from "next/server";
import {
  normalizeExternalOrderId,
  normalizeIntegrationSource,
  requireV1ApiKey,
} from "@/lib/tenant/v1Api";
import { runAutoAssignment } from "@/lib/autoAssign";
import { cleanPhoneInput, isValidPakistaniMobile } from "@/lib/phone";
import { geocodeAddress } from "@/lib/geocode";
import { customerTrackingUrl } from "@/lib/appUrl";
import { getCustomerTrackingUrlForOrder } from "@/lib/trackingTokens";
import { performRiderAssignment } from "@/lib/assignRider";

// Public merchant inbound API — API key only (no browser session).
export async function POST(req: Request) {
  const guard = await requireV1ApiKey(req);
  if ("error" in guard) return guard.error;
  const { tenant, service } = guard;

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
    source,
    external_order_id,
    rider_id,
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

  const normalizedSource = normalizeIntegrationSource(source);
  if (source != null && source !== "" && !normalizedSource) {
    return NextResponse.json(
      {
        status: "invalid_source",
        message: "source must be 1–64 chars: letters, numbers, underscore, hyphen (e.g. golootlo, pos, website).",
      },
      { status: 400 }
    );
  }

  const externalOrderId = normalizeExternalOrderId(external_order_id);
  if (external_order_id != null && external_order_id !== "" && !externalOrderId) {
    return NextResponse.json({ status: "invalid_external_order_id" }, { status: 400 });
  }

  const resolvedPickupLat = pickup_lat ?? tenant.defaultPickupLat;
  const resolvedPickupLng = pickup_lng ?? tenant.defaultPickupLng;

  let resolvedDeliveryLat = delivery_lat ?? null;
  let resolvedDeliveryLng = delivery_lng ?? null;
  if (resolvedDeliveryLat == null && resolvedDeliveryLng == null) {
    const geocoded = await geocodeAddress(delivery_address);
    if (geocoded) {
      resolvedDeliveryLat = geocoded.lat;
      resolvedDeliveryLng = geocoded.lng;
    }
  }

  const { data: order, error } = await service
    .from("orders")
    .insert({
      tenant_id: tenant.id,
      customer_name,
      customer_phone: cleanPhoneInput(customer_phone),
      delivery_address,
      delivery_lat: resolvedDeliveryLat,
      delivery_lng: resolvedDeliveryLng,
      address_detail: address_detail?.trim() || null,
      pickup_lat: resolvedPickupLat ?? null,
      pickup_lng: resolvedPickupLng ?? null,
      source: normalizedSource,
      external_order_id: externalOrderId,
    })
    .select()
    .single();

  if (error || !order) {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  // Explicit rider_id wins over auto-assign (POS / Golootlo pick a rider themselves).
  if (rider_id) {
    const { data: rider } = await service
      .from("riders")
      .select("id, tenant_id, name, phone, active")
      .eq("id", rider_id)
      .maybeSingle();

    if (!rider || rider.tenant_id !== tenant.id || !rider.active) {
      return NextResponse.json(
        {
          status: "rider_not_found",
          order,
          message: "Order created but rider_id is invalid for this tenant.",
        },
        { status: 404 }
      );
    }

    try {
      const result = await performRiderAssignment(service, {
        orderId: order.id,
        riderId: rider.id,
        riderPhone: rider.phone,
        customerPhone: order.customer_phone,
        customerName: order.customer_name,
        isReassignment: false,
      });

      const { data: finalOrder } = await service.from("orders").select().eq("id", order.id).single();
      const token = result.customerTrackingToken;
      return NextResponse.json({
        status: "ok",
        order: finalOrder ?? order,
        assignedRider: { id: rider.id, name: rider.name },
        customer_tracking_url: token ? customerTrackingUrl(token) : null,
      });
    } catch {
      return NextResponse.json(
        { status: "assign_failed", order, message: "Order created but assignment failed." },
        { status: 500 }
      );
    }
  }

  const assignment =
    resolvedPickupLat != null && resolvedPickupLng != null
      ? await runAutoAssignment(service, tenant.id, order.id, {
          lat: resolvedPickupLat,
          lng: resolvedPickupLng,
        })
      : null;

  const { data: finalOrder } = await service.from("orders").select().eq("id", order.id).single();

  const customerTrackingUrlValue = assignment?.customerTrackingToken
    ? customerTrackingUrl(assignment.customerTrackingToken)
    : await getCustomerTrackingUrlForOrder(service, order.id);

  return NextResponse.json({
    status: "ok",
    order: finalOrder ?? order,
    assignedRider: assignment ? { id: assignment.riderId, name: assignment.riderName } : null,
    customer_tracking_url: customerTrackingUrlValue,
  });
}
