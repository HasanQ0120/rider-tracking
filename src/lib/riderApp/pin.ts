import "server-only";

const LOGIN_PIN_REGEX = /^\d{6}$/;

export function isValidLoginPin(pin: unknown): pin is string {
  return typeof pin === "string" && LOGIN_PIN_REGEX.test(pin);
}

export const LOGIN_PIN_HINT = "Login PIN must be exactly 6 digits.";
