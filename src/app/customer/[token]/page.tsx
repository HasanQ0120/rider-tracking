import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import { CustomerTrackingClient } from "./CustomerTrackingClient";

// Purely for the link-preview card (WhatsApp, etc.) -- a plain read with no
// gating on tracking_tokens.active and no device-lock/session table
// touched at all, so it can't ever "consume" anything. This runs as
// ordinary Server Component metadata generation, entirely separate from
// (and unable to trigger) the client-side useEffect that does the actual
// tracking-session logic below.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const supabase = createServiceClient();
  const { data: tokenRow } = await supabase
    .from("tracking_tokens")
    .select("order_id")
    .eq("token", token)
    .eq("type", "customer")
    .maybeSingle();

  const { data: order } = tokenRow
    ? await supabase.from("orders").select("customer_name").eq("id", tokenRow.order_id).single()
    : { data: null };

  return {
    title: order ? `Track your delivery, ${order.customer_name}` : "Rider Tracking",
    description: "Track your delivery live.",
  };
}

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CustomerTrackingClient token={token} />;
}
