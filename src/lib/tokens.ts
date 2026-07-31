import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";

// 24+ url-safe characters, effectively unguessable.
export function generateTrackingToken(): string {
  return nanoid(28);
}

export function generateSessionId(): string {
  return nanoid(24);
}

// A merchant's inbound-API credential. Prefixed so it's recognizable in
// logs/support conversations without revealing the secret, and so the
// server can narrow a lookup to one tenant (indexed api_key_prefix) before
// the far more expensive bcrypt compare against that row's api_key_hash.
// Only ever stored as a bcrypt hash (via hashPin/verifyPin, reused as-is --
// they're already generic bcrypt wrappers, not PIN-specific); the raw value
// is shown to the merchant exactly once, at generation time.
const API_KEY_PREFIX_LENGTH = 12;

export function generateApiKey(): { key: string; prefix: string } {
  const key = `rt_live_${nanoid(32)}`;
  return { key, prefix: key.slice(0, API_KEY_PREFIX_LENGTH) };
}

export function apiKeyPrefix(key: string): string {
  return key.slice(0, API_KEY_PREFIX_LENGTH);
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
