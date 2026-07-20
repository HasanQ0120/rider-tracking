// Tokens/PINs must never sit in plaintext in logs. This runs even in the
// no-op console stub so the masking behavior is exercised well before a
// real provider (Twilio/WhatsApp) is plugged in.
export function maskSecrets(message: string): string {
  return message
    .replace(/[A-Za-z0-9_-]{16,}/g, (m) => `${m.slice(0, 4)}…${m.slice(-4)}`)
    .replace(/\b\d{6}\b/g, "••••••");
}
