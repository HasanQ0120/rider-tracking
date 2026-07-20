import "server-only";
import jwt from "jsonwebtoken";

const TTL_SECONDS = 15 * 60;

// Short-lived JWT carrying an order_id claim, checked by the
// "customer reads own order location" RLS policy on current_locations.
// Re-minted every ~10 min by the client re-calling init, which re-validates
// the customer token against the DB each time -- so access is enforced on
// every connection, not just once at first load.
export function signCustomerJwt(orderId: string): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error("SUPABASE_JWT_SECRET is not configured");

  return jwt.sign(
    { role: "authenticated", aud: "authenticated", order_id: orderId },
    secret,
    { expiresIn: TTL_SECONDS }
  );
}

export const CUSTOMER_JWT_TTL_MS = TTL_SECONDS * 1000;
