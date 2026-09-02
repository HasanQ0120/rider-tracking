import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { generateApiKey, hashPin } from "@/lib/tokens";
import {
  DEFAULT_MERCHANT_ACCENT,
  DEFAULT_MERCHANT_PRIMARY,
  DEFAULT_MERCHANT_SECONDARY,
} from "@/lib/merchant/branding";
import { merchantIdToEmail } from "@/lib/admin/merchantEmail";
import {
  normalizeMerchantId,
  validateMerchantId,
  validatePassword,
  validateTenantName,
} from "@/lib/admin/tenantValidation";

export type ProvisionTenantInput = {
  merchantId: string;
  name: string;
  password: string;
  contactEmail?: string | null;
  generateApiKeyOnCreate?: boolean;
};

export type ProvisionTenantResult =
  | {
      ok: true;
      tenantId: string;
      merchantId: string;
      apiKey?: string;
      apiKeyPrefix?: string;
    }
  | { ok: false; error: string };

export async function provisionTenant(input: ProvisionTenantInput): Promise<ProvisionTenantResult> {
  const merchantId = normalizeMerchantId(input.merchantId);
  const name = input.name.trim();
  const password = input.password;

  const merchantIdError = validateMerchantId(merchantId);
  if (merchantIdError) return { ok: false, error: merchantIdError };

  const nameError = validateTenantName(name);
  if (nameError) return { ok: false, error: nameError };

  const passwordError = validatePassword(password);
  if (passwordError) return { ok: false, error: passwordError };

  const service = createServiceClient();

  const { data: existing } = await service
    .from("tenants")
    .select("id")
    .eq("merchant_id", merchantId)
    .maybeSingle();

  if (existing) {
    return { ok: false, error: "A tenant with this merchant ID already exists." };
  }

  const { data: tenant, error: insertError } = await service
    .from("tenants")
    .insert({
      merchant_id: merchantId,
      name,
      contact_email: input.contactEmail?.trim() || null,
      primary_color: DEFAULT_MERCHANT_PRIMARY,
      secondary_color: DEFAULT_MERCHANT_SECONDARY,
      accent_color: DEFAULT_MERCHANT_ACCENT,
    })
    .select("id")
    .single();

  if (insertError || !tenant) {
    return { ok: false, error: insertError?.message ?? "Failed to create tenant." };
  }

  const email = merchantIdToEmail(merchantId);
  const { data: authUser, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "merchant", tenant_id: tenant.id },
  });

  if (authError || !authUser.user) {
    await service.from("tenants").delete().eq("id", tenant.id);
    return { ok: false, error: authError?.message ?? "Failed to create merchant auth user." };
  }

  const { error: linkError } = await service
    .from("tenants")
    .update({ auth_user_id: authUser.user.id })
    .eq("id", tenant.id);

  if (linkError) {
    await service.auth.admin.deleteUser(authUser.user.id);
    await service.from("tenants").delete().eq("id", tenant.id);
    return { ok: false, error: linkError.message };
  }

  let apiKey: string | undefined;
  let apiKeyPrefix: string | undefined;

  if (input.generateApiKeyOnCreate) {
    const generated = generateApiKey();
    const hash = await hashPin(generated.key);
    const { error: keyError } = await service
      .from("tenants")
      .update({ api_key_hash: hash, api_key_prefix: generated.prefix })
      .eq("id", tenant.id);

    if (keyError) {
      return {
        ok: true,
        tenantId: tenant.id,
        merchantId,
      };
    }

    apiKey = generated.key;
    apiKeyPrefix = generated.prefix;
  }

  return {
    ok: true,
    tenantId: tenant.id,
    merchantId,
    apiKey,
    apiKeyPrefix,
  };
}

export async function resetMerchantPassword(
  tenantId: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const passwordError = validatePassword(password);
  if (passwordError) return { ok: false, error: passwordError };

  const service = createServiceClient();
  const { data: tenant } = await service
    .from("tenants")
    .select("auth_user_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant?.auth_user_id) {
    return { ok: false, error: "Tenant has no linked auth user." };
  }

  const { error } = await service.auth.admin.updateUserById(tenant.auth_user_id, { password });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
