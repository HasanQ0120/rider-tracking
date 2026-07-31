import { NextResponse } from "next/server";
import { requireMerchantUserApi } from "@/lib/merchant/authGuardApi";
import { parseRiderCsv } from "@/lib/riderCsv";

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

  // Same RLS-enforced authenticated client as the single-rider create
  // route -- the "merchant inserts own riders" policy is what actually
  // scopes a ~400-row import to this tenant, not just this query.
  const { data, error } = await guard.supabase
    .from("riders")
    .insert(
      valid.map((r) => ({
        tenant_id: guard.tenantId,
        name: r.name,
        phone: r.phone,
        license_plate: r.license_plate,
      }))
    )
    .select();

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });
  return NextResponse.json({ status: "ok", imported: data?.length ?? 0, riders: data, errors });
}
