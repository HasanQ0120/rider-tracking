// Accepts the two common Pakistani mobile formats: local (03XXXXXXXXX, 11
// digits) and international (+923XXXXXXXXX or 923XXXXXXXXX) -- both are the
// country's "3" mobile prefix followed by the same 10-digit subscriber
// number, just with a different prefix (0, or the 92 country code with or
// without a leading +). Spaces and dashes are tolerated in the input but
// stripped before matching/storage so numbers end up in one consistent
// shape.
const PK_MOBILE_REGEX = /^(?:\+92|92|0)3\d{9}$/;

export function cleanPhoneInput(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

export function isValidPakistaniMobile(raw: string): boolean {
  return PK_MOBILE_REGEX.test(cleanPhoneInput(raw));
}

export const PK_MOBILE_HINT =
  "Enter a valid Pakistani mobile number (e.g. 03XXXXXXXXX or +923XXXXXXXXX).";
