import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";

// 24+ url-safe characters, effectively unguessable.
export function generateTrackingToken(): string {
  return nanoid(28);
}

export function generateSessionId(): string {
  return nanoid(24);
}

export function generateDeviceKey(): string {
  return nanoid(24);
}

export function generatePin(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, "0");
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

// Compatible with bcrypt hashes produced by Postgres's crypt(pin, gen_salt('bf')),
// used by the cron-driven reissue path -- one hash format, verified the same
// way regardless of which side generated it.
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}
