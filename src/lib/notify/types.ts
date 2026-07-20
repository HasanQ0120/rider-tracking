export interface NotificationResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface NotificationProvider {
  send(to: string, message: string): Promise<NotificationResult>;
}
