import { NextResponse } from "next/server";
import { requireMerchantUserApi } from "@/lib/merchant/authGuardApi";
import { createServiceClient } from "@/lib/supabase/service";
import { generateApiKey, hashPin } from "@/lib/tokens";

// Generating a key requires bcrypt-hashing server-side before storage --
// something a plain client-side .update() call can't do -- so this always
// goes through service-role, explicitly scoped to the caller's own
// guard.tenantId, rather than the merchant's RLS-restricted authClient
// (which also doesn't grant UPDATE on api_key_hash/api_key_prefix at all,
// see migration 0021's column-level revoke+grant).
export async function POST() {
  const guard = await requireMerchantUserApi();
  if ("error" in guard) return guard.error;

  const { key, prefix } = generateApiKey();
  const hash = await hashPin(key);

  const service = createServiceClient();
  const { error } = await service
    .from("tenants")
    .update({ api_key_hash: hash, api_key_prefix: prefix })
    .eq("id", guard.tenantId);

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });

  // The only time the raw key is ever readable -- not retrievable again
  // after this response, only the hash is kept.
  return NextResponse.json({ status: "ok", apiKey: key, prefix });
}

export async function DELETE() {
  const guard = await requireMerchantUserApi();
  if ("error" in guard) return guard.error;

  const service = createServiceClient();
  const { error } = await service
    .from("tenants")
    .update({ api_key_hash: null, api_key_prefix: null })
    .eq("id", guard.tenantId);

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });
  return NextResponse.json({ status: "ok" });
}
