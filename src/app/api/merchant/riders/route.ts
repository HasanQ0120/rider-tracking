import { NextResponse } from "next/server";
import { requireMerchantUserApi } from "@/lib/merchant/authGuardApi";
import { cleanPhoneInput, isValidPakistaniMobile } from "@/lib/phone";
import { generateDutyToken } from "@/lib/tokens";

export async function POST(req: Request) {
  const guard = await requireMerchantUserApi();
  if ("error" in guard) return guard.error;

  const { name, phone, license_plate } = await req.json();
  if (!name || !phone || !license_plate) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }
  if (!isValidPakistaniMobile(phone)) {
    return NextResponse.json({ status: "invalid_phone" }, { status: 400 });
  }

  const { data, error } = await guard.supabase
    .from("riders")
    .insert({
      tenant_id: guard.tenantId,
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
