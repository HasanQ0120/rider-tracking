import { nanoid } from "nanoid";

// Browser-side only: persisted per-token in localStorage so the same
// device reopening the link is recognized without re-verifying the PIN.
export function getOrCreateDeviceKey(token: string): string {
  const storageKey = `rt_device_${token}`;
  const existing = localStorage.getItem(storageKey);
  if (existing) return existing;
  const key = nanoid(24);
  localStorage.setItem(storageKey, key);
  return key;
}
