/** Synthetic login email for merchant dashboard auth (see merchant login). */
export function merchantIdToEmail(merchantId: string): string {
  return `${merchantId.trim().toLowerCase()}@merchants.internal`;
}
