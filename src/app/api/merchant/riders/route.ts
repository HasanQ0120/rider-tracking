import { NextResponse } from "next/server";
import { requireMerchantUserApi } from "@/lib/merchant/authGuardApi";
import { cleanPhoneInput, isValidPakistaniMobile } from "@/lib/phone";
import { generateAvailabilityToken } from "@/lib/tokens";
import { sendAvailabilityLink } from "@/lib/notify";

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

  const cleanedPhone = cleanPhoneInput(phone);
  const availabilityToken = generateAvailabilityToken();

  const { data, error } = await guard.supabase
    .from("riders")
    .insert({
      tenant_id: guard.tenantId,
      name,
      phone: cleanedPhone,
      license_plate,
      availability_token: availabilityToken,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });
  await sendAvailabilityLink(cleanedPhone, availabilityToken);
  return NextResponse.json({ rider: data });
}
