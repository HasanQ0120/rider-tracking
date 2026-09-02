import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { customerTrackingUrl } from "@/lib/appUrl";

export async function getActiveCustomerToken(
  supabase: SupabaseClient,
  orderId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("tracking_tokens")
    .select("token")
    .eq("order_id", orderId)
    .eq("type", "customer")
    .eq("active", true)
    .maybeSingle();
  return data?.token ?? null;
}

export async function getCustomerTrackingUrlForOrder(
  supabase: SupabaseClient,
  orderId: string
): Promise<string | null> {
  const token = await getActiveCustomerToken(supabase, orderId);
  return token ? customerTrackingUrl(token) : null;
}
