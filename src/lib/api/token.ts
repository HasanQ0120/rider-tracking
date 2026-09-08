import { SESSION_COOKIE, SESSION_MAX_AGE_S, SESSION_STORAGE_KEY } from "./config";

/** Client-only: persist JWT for axios Bearer + middleware-readable cookie. */
export function setPortalToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_STORAGE_KEY, token);
  document.cookie = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE_S}`,
    "SameSite=Lax",
  ].join("; ");
}

export function getPortalToken(): string | null {
  if (typeof window === "undefined") return null;
  const fromStorage = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (fromStorage) return fromStorage;
  const match = document.cookie.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearPortalToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
