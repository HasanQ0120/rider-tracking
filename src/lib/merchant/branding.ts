export type TenantBranding = {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

export const DEFAULT_MERCHANT_PRIMARY = "#1e3a5f";
export const DEFAULT_MERCHANT_SECONDARY = "#FFD700";
export const DEFAULT_MERCHANT_ACCENT = "#DC2626";

export function isValidHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

export function normalizeHexColor(value: string | null | undefined, fallback: string): string {
  if (value && isValidHexColor(value)) return value;
  return fallback;
}

export function brandingFromRow(row: {
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
}): TenantBranding {
  return {
    logoUrl: row.logo_url?.trim() || null,
    primaryColor: normalizeHexColor(row.primary_color, DEFAULT_MERCHANT_PRIMARY),
    secondaryColor: normalizeHexColor(row.secondary_color, DEFAULT_MERCHANT_SECONDARY),
    accentColor: normalizeHexColor(row.accent_color, DEFAULT_MERCHANT_ACCENT),
  };
}
