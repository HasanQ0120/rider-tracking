import { NextResponse } from "next/server";
import { requireMerchantUserApi } from "@/lib/merchant/authGuardApi";
import { createServiceClient } from "@/lib/supabase/service";
import { validateRiderFields } from "@/lib/riderValidation";
import { buildRiderInsertRows } from "@/lib/rider/insertRows";
import { sendAvailabilityLink } from "@/lib/notify";

const RIDER_LIST_SELECT = "id, name, phone, active, available, license_plate, created_at";

/** Session-authenticated rider list for the merchant portal. */
export async function GET(req: Request) {
  const guard = await requireMerchantUserApi();
  if ("error" in guard) return guard.error;

  const url = new URL(req.url);
  const activeParam = url.searchParams.get("active");
  const availableParam = url.searchParams.get("available");

  const service = createServiceClient();
  let query = service
    .from("riders")
    .select(RIDER_LIST_SELECT)
    .eq("tenant_id", guard.tenantId)
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
