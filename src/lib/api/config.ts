export const SESSION_COOKIE = "rt_session";
export const SESSION_STORAGE_KEY = "rt_token";
export const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60;

export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!url) {
    // Dev default — set NEXT_PUBLIC_API_URL in .env.local for other hosts/ports.
    return "http://localhost:4000";
  }
  return url;
}
