import "server-only";

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function customerTrackingUrl(token: string): string {
  return `${appUrl()}/customer/${token}`;
}
