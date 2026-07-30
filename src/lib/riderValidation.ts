import "server-only";
import { cleanPhoneInput, isValidPakistaniMobile, PK_MOBILE_HINT } from "@/lib/phone";

export type ParsedRider = { name: string; phone: string; license_plate: string };

// The three fields every rider-creation path requires (manual "Add Rider",
// CSV import, and the inbound API) -- one place for the rules so they can't
// drift apart between callers.
export function validateRiderFields(input: {
  name?: unknown;
  phone?: unknown;
  license_plate?: unknown;
}): { ok: true; rider: ParsedRider } | { ok: false; reason: string } {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  const licensePlate = typeof input.license_plate === "string" ? input.license_plate.trim() : "";

  if (!name) {
    return { ok: false, reason: "Missing name" };
  }
  if (!phone || !isValidPakistaniMobile(phone)) {
    return { ok: false, reason: `Missing or invalid phone -- ${PK_MOBILE_HINT}` };
  }
  if (!licensePlate) {
    return { ok: false, reason: "Missing license plate" };
  }
  return { ok: true, rider: { name, phone: cleanPhoneInput(phone), license_plate: licensePlate } };
}
