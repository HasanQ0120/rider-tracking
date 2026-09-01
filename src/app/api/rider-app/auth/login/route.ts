import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cleanPhoneInput, isValidPakistaniMobile } from "@/lib/phone";
import { verifyPin } from "@/lib/tokens";
import { signRiderSession } from "@/lib/riderApp/session";
import { isValidLoginPin, LOGIN_PIN_HINT } from "@/lib/riderApp/pin";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const { phone, pin, merchant_id } = body as {
    phone?: unknown;
    pin?: unknown;
    merchant_id?: unknown;
  };

  if (typeof phone !== "string" || typeof merchant_id !== "string" || !merchant_id.trim()) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }
  if (!isValidPakistaniMobile(phone)) {
    return NextResponse.json({ status: "invalid_phone" }, { status: 400 });
  }
  if (!isValidLoginPin(pin)) {
    return NextResponse.json({ status: "invalid_pin", hint: LOGIN_PIN_HINT }, { status: 400 });
  }

  const supabase = createServiceClient();
  const cleanedPhone = cleanPhoneInput(phone);

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id, merchant_id, name, active, suspended_at")
    .eq("merchant_id", merchant_id.trim())
    .maybeSingle();

  if (tenantError) {
    console.error("[rider-app/login] tenant lookup failed", tenantError);
    return NextResponse.json(
      {
        status: "error",
        code: "tenant_lookup_failed",
        message:
          process.env.NODE_ENV === "development"
            ? tenantError.message
            : "Could not verify merchant.",
      },
      { status: 500 }
    );
  }
  if (!tenant || !tenant.active || tenant.suspended_at) {
    return NextResponse.json({ status: "invalid_credentials" }, { status: 401 });
  }

  const { data: rider, error: riderError } = await supabase
    .from("riders")
    .select("id, tenant_id, name, phone, license_plate, active, available, login_pin_hash")
    .eq("tenant_id", tenant.id)
    .eq("phone", cleanedPhone)
    .maybeSingle();

  if (riderError) {
    console.error("[rider-app/login] rider lookup failed", riderError);
    return NextResponse.json(
      {
        status: "error",
        code: "rider_lookup_failed",
        message:
          process.env.NODE_ENV === "development"
            ? riderError.message
            : "Could not verify rider.",
      },
      { status: 500 }
    );
  }
  if (!rider || !rider.active || !rider.login_pin_hash) {
    return NextResponse.json({ status: "invalid_credentials" }, { status: 401 });
  }

  const pinOk = await verifyPin(pin, rider.login_pin_hash);
  if (!pinOk) {
    return NextResponse.json({ status: "invalid_credentials" }, { status: 401 });
  }

  let token: string;
  try {
    token = await signRiderSession({
      riderId: rider.id,
      tenantId: rider.tenant_id,
      phone: rider.phone,
    });
  } catch {
    return NextResponse.json({ status: "error", message: "Auth not configured" }, { status: 500 });
  }

  return NextResponse.json({
    status: "ok",
    token,
    rider: {
      id: rider.id,
      name: rider.name,
      phone: rider.phone,
      license_plate: rider.license_plate,
      available: rider.available,
    },
    tenant: {
      id: tenant.id,
      merchant_id: tenant.merchant_id,
      name: tenant.name,
    },
  });
}
