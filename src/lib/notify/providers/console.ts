import "server-only";
import type { NotificationProvider, NotificationResult } from "../types";
import { maskSecrets } from "../mask";

// Default v1 stub -- swap `provider` in ../index.ts for a real
// Twilio/WhatsApp Business API implementation later. Token/session/expiry
// logic never needs to change when that swap happens.
export const consoleProvider: NotificationProvider = {
  async send(to: string, message: string): Promise<NotificationResult> {
    console.log(`[notify:stub] -> ${to}: ${maskSecrets(message)}`);
    return { ok: true, providerMessageId: `stub_${Date.now()}` };
  },
};
