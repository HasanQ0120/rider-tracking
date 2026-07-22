import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOpsUserApi } from "@/lib/ops/authGuardApi";
import { cleanPhoneInput, isValidPakistaniMobile } from "@/lib/phone";

export async function GET() {
  const guard = await requireOpsUserApi();
  if ("error" in guard) return guard.error;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, customer_name, customer_phone, delivery_address, status, assigned_rider_id, tracking_expired_unresolved, delivery_confirmed_by, created_at, delivered_at, riders:assigned_rider_id(name, phone)"
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });
  return NextResponse.json({ orders: data });
}

export async function POST(req: Request) {
  const guard = await requireOpsUserApi();
  if ("error" in guard) return guard.error;

  const {
    customer_name,
    customer_phone,
    delivery_address,
    delivery_lat,
    delivery_lng,
    address_detail,
  } = await req.json();

  if (!customer_name || !customer_phone || !delivery_address) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }
  if (!isValidPakistaniMobile(customer_phone)) {
    return NextResponse.json({ status: "invalid_phone" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .insert({
      customer_name,
      customer_phone: cleanPhoneInput(customer_phone),
      delivery_address,
      delivery_lat: delivery_lat ?? null,
      delivery_lng: delivery_lng ?? null,
      address_detail: address_detail?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });
  return NextResponse.json({ order: data });
}
