import { NextResponse } from "next/server";
import { requireMerchantUserApi } from "@/lib/merchant/authGuardApi";
import { validateRiderFields } from "@/lib/riderValidation";
import { buildRiderInsertRows } from "@/lib/rider/insertRows";
import { sendAvailabilityLink } from "@/lib/notify";

export async function POST(req: Request) {
  const guard = await requireMerchantUserApi();
  if ("error" in guard) return guard.error;

  const body = await req.json().catch(() => null);
  const result = validateRiderFields(body ?? {});
  if (!result.ok) {
    return NextResponse.json({ status: "invalid_request", reason: result.reason }, { status: 400 });
  }

  const [row] = await buildRiderInsertRows(guard.tenantId, [result.rider]);

  const { data, error } = await guard.supabase.from("riders").insert(row).select().single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ status: "duplicate_phone" }, { status: 409 });
    }
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
  await sendAvailabilityLink(row.phone, row.availability_token);
  return NextResponse.json({ rider: data });
}
