import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOpsUserApi } from "@/lib/ops/authGuardApi";
import { getOpsHomeTenantId } from "@/lib/ops/homeTenant";
import { cleanPhoneInput, isValidPakistaniMobile } from "@/lib/phone";
import { generateDutyToken } from "@/lib/tokens";

export async function GET() {
  const guard = await requireOpsUserApi();
  if ("error" in guard) return guard.error;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("riders")
    .select("id, name, phone, license_plate, active, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });
  return NextResponse.json({ riders: data });
}

export async function POST(req: Request) {
  const guard = await requireOpsUserApi();
  if ("error" in guard) return guard.error;

  const { name, phone, license_plate } = await req.json();
  if (!name || !phone || !license_plate) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }
  if (!isValidPakistaniMobile(phone)) {
    return NextResponse.json({ status: "invalid_phone" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const tenantId = await getOpsHomeTenantId(supabase);
  const { data, error } = await supabase
    .from("riders")
    .insert({
      tenant_id: tenantId,
      name,
      phone: cleanPhoneInput(phone),
      license_plate,
      duty_token: generateDutyToken(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });
  return NextResponse.json({ rider: data });
}
