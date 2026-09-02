import { NextResponse } from "next/server";
import { requireMerchantUserApi } from "@/lib/merchant/authGuardApi";
import { createServiceClient } from "@/lib/supabase/service";
import {
  logoObjectPath,
  logoValidationError,
  TENANT_LOGOS_BUCKET,
  tenantLogoPublicUrl,
} from "@/lib/merchant/tenantLogoStorage";

export async function POST(req: Request) {
  const guard = await requireMerchantUserApi();
  if ("error" in guard) return guard.error;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ status: "invalid_request", message: "Missing file." }, { status: 400 });
  }

  const validationError = logoValidationError(file);
  if (validationError) {
    return NextResponse.json({ status: "invalid_file", message: validationError }, { status: 400 });
  }

  const objectPath = logoObjectPath(guard.tenantId, file.type);
  const bytes = Buffer.from(await file.arrayBuffer());

  const supabase = createServiceClient();
  const { error: uploadError } = await supabase.storage
    .from(TENANT_LOGOS_BUCKET)
    .upload(objectPath, bytes, {
      contentType: file.type,
      upsert: true,
      cacheControl: "3600",
    });

  if (uploadError) {
    console.error("[merchant/branding/logo] upload failed", uploadError);
    return NextResponse.json(
      {
        status: "error",
        message:
          uploadError.message.includes("Bucket not found")
            ? "Storage bucket missing — run migration 0030_tenant_logos_storage.sql in Supabase."
            : "Could not upload logo.",
      },
      { status: 500 }
    );
  }

  const logoUrl = `${tenantLogoPublicUrl(objectPath)}?v=${Date.now()}`;
  const { error: updateError } = await supabase
    .from("tenants")
    .update({ logo_url: logoUrl })
    .eq("id", guard.tenantId);

  if (updateError) {
    console.error("[merchant/branding/logo] tenant update failed", updateError);
    return NextResponse.json({ status: "error", message: "Logo uploaded but could not save URL." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", logo_url: logoUrl });
}

export async function DELETE() {
  const guard = await requireMerchantUserApi();
  if ("error" in guard) return guard.error;

  const supabase = createServiceClient();
  const { data: existing } = await supabase.storage.from(TENANT_LOGOS_BUCKET).list(guard.tenantId);

  if (existing && existing.length > 0) {
    const paths = existing.map((obj) => `${guard.tenantId}/${obj.name}`);
    const { error: removeError } = await supabase.storage.from(TENANT_LOGOS_BUCKET).remove(paths);
    if (removeError) {
      console.error("[merchant/branding/logo] remove failed", removeError);
      return NextResponse.json({ status: "error", message: "Could not remove logo file." }, { status: 500 });
    }
  }

  const { error: updateError } = await supabase
    .from("tenants")
    .update({ logo_url: null })
    .eq("id", guard.tenantId);

  if (updateError) {
    return NextResponse.json({ status: "error", message: "Could not clear logo." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
