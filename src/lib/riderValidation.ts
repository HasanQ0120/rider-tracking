import { cleanPhoneInput, isValidPakistaniMobile, PK_MOBILE_HINT } from "@/lib/phone";
import { isValidLoginPin, LOGIN_PIN_HINT } from "@/lib/riderPin";

export type ParsedRider = { name: string; phone: string; license_plate: string; login_pin: string };

// Fields every rider-creation path requires (manual "Add Rider", CSV import,
// inbound API) -- one place for the rules so they can't drift apart.
export function validateRiderFields(input: {
  name?: unknown;
  phone?: unknown;
  license_plate?: unknown;
  login_pin?: unknown;
}): { ok: true; rider: ParsedRider } | { ok: false; reason: string } {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  const licensePlate = typeof input.license_plate === "string" ? input.license_plate.trim() : "";
  const loginPin = typeof input.login_pin === "string" ? input.login_pin.trim() : "";

  if (!name) {
    return { ok: false, reason: "Missing name" };
  }
  if (!phone || !isValidPakistaniMobile(phone)) {
    return { ok: false, reason: `Missing or invalid phone -- ${PK_MOBILE_HINT}` };
  }
  if (!licensePlate) {
    return { ok: false, reason: "Missing license plate" };
  }
  if (!isValidLoginPin(loginPin)) {
    return { ok: false, reason: `Missing or invalid login PIN -- ${LOGIN_PIN_HINT}` };
  }
  return {
    ok: true,
    rider: { name, phone: cleanPhoneInput(phone), license_plate: licensePlate, login_pin: loginPin },
  };
}
