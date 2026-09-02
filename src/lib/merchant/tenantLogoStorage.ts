import "server-only";

export const TENANT_LOGOS_BUCKET = "tenant-logos";
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export const ALLOWED_LOGO_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function logoObjectPath(tenantId: string, mimeType: string): string {
  const ext = MIME_TO_EXT[mimeType] ?? "png";
  return `${tenantId}/logo.${ext}`;
}

export function tenantLogoPublicUrl(objectPath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  return `${base}/storage/v1/object/public/${TENANT_LOGOS_BUCKET}/${objectPath}`;
}

export function isAllowedLogoFile(file: File): boolean {
  return ALLOWED_LOGO_MIME_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_LOGO_BYTES;
}

export function logoValidationError(file: File): string | null {
  if (!ALLOWED_LOGO_MIME_TYPES.has(file.type)) {
    return "Logo must be PNG, JPEG, or WebP.";
  }
  if (file.size <= 0) {
    return "File is empty.";
  }
  if (file.size > MAX_LOGO_BYTES) {
    return "Logo must be 2 MB or smaller.";
  }
  return null;
}
