import "server-only";
import type { NotificationProvider } from "./types";
import { consoleProvider } from "./providers/console";

// Swap this one line for a Twilio/WhatsApp provider later -- every call site
// below funnels through sendNotification(), nothing else touches SMS logic.
const provider: NotificationProvider = consoleProvider;

// True only while `provider` above is the console stub -- lets ops-facing
// routes decide whether it's safe to hand back a plaintext PIN in their API
// response for testing (no real SMS is being sent yet, so nothing is
// actually being kept confidential in the first place). Flip this to false
// the moment a real provider is wired in; nothing else needs to change.
export const isTestNotificationProvider = provider === consoleProvider;

export function sendNotification(to: string, message: string) {
  return provider.send(to, message);
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function sendRiderLink(phone: string, token: string) {
  return sendNotification(
    phone,
    `You've been assigned a delivery. Track & share your location here: ${appUrl()}/rider/${token}`
  );
}

export function sendRiderPin(phone: string, pin: string) {
  return sendNotification(
    phone,
    `Your delivery tracking PIN is ${pin}. Enter it on the tracking page to start sharing your location.`
  );
}

export function sendCustomerLink(phone: string, token: string) {
  return sendNotification(
    phone,
    `Your delivery is on its way! Track it live here: ${appUrl()}/customer/${token}`
  );
}
