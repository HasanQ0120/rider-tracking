const MERCHANT_ID_PATTERN = /^[A-Za-z0-9_-]{2,32}$/;

export function normalizeMerchantId(raw: string): string {
  return raw.trim().toUpperCase();
}

export function validateMerchantId(merchantId: string): string | null {
  if (!MERCHANT_ID_PATTERN.test(merchantId)) {
    return "Merchant ID must be 2–32 characters (letters, numbers, underscore, hyphen).";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

export function validateTenantName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return "Name must be at least 2 characters.";
  }
  if (trimmed.length > 120) {
    return "Name must be at most 120 characters.";
  }
  return null;
}
