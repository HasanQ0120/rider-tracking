import { NextResponse } from "next/server";
import { requireMerchantUserApi } from "@/lib/merchant/authGuardApi";
import { parseRiderCsv } from "@/lib/riderCsv";
import { buildRiderInsertRows } from "@/lib/rider/insertRows";
import { sendAvailabilityLink } from "@/lib/notify";

export async function POST(req: Request) {
  const guard = await requireMerchantUserApi();
  if ("error" in guard) return guard.error;

  const { csv } = await req.json().catch(() => ({ csv: undefined }));
  if (typeof csv !== "string" || !csv.trim()) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const { valid, errors } = parseRiderCsv(csv);
  if (valid.length === 0) {
    return NextResponse.json({ status: "ok", imported: 0, errors });
  }

  const withTokens = await buildRiderInsertRows(guard.tenantId, valid);

  const { data, error } = await guard.supabase.from("riders").insert(withTokens).select();

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });
  await Promise.all(withTokens.map((r) => sendAvailabilityLink(r.phone, r.availability_token)));
  return NextResponse.json({ status: "ok", imported: data?.length ?? 0, riders: data, errors });
}
