import type { Metadata } from "next";
import { apiUrl } from "@/lib/api/browserFetch";
import { RiderTrackingClient } from "./RiderTrackingClient";

// Purely for the link-preview card (WhatsApp, etc.) -- a plain read with no
// gating on tracking_tokens.active and no device-lock/session table
// touched at all, so it can't ever "consume" anything.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  let customerName: string | null = null;
  try {
    const res = await fetch(apiUrl(`/api/rider/${token}/preview`), {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const data = (await res.json()) as { customer_name?: string | null };
      customerName = data.customer_name ?? null;
    }
  } catch {
    // Fall through to generic title
  }

  return {
    title: customerName ? `Delivery for ${customerName}` : "Rider Tracking",
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
