import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import { RiderTrackingClient } from "./RiderTrackingClient";

// Purely for the link-preview card (WhatsApp, etc.) -- a plain read with no
// gating on tracking_tokens.active and no device-lock/session table
// touched at all, so it can't ever "consume" anything. This runs as
// ordinary Server Component metadata generation, entirely separate from
// (and unable to trigger) the client-side useEffect that does the actual
// device-lock/session logic below.
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
    .eq("type", "rider")
    .maybeSingle();

  const { data: order } = tokenRow
    ? await supabase.from("orders").select("customer_name").eq("id", tokenRow.order_id).single()
    : { data: null };

  return {
    title: order ? `Delivery for ${order.customer_name}` : "Rider Tracking",
    description: "Share your live location for this delivery.",
  };
}

export default async function RiderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <RiderTrackingClient token={token} />;
}
