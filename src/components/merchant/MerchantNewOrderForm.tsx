"use client";

import { useRouter } from "next/navigation";
import { NewOrderForm } from "@/components/ops/NewOrderForm";

// Thin client wrapper: onCreated is a plain closure and can't cross the
// server/client boundary from the (server component) page, so this owns
// the post-create redirect instead. There's no merchant order-detail page
// yet, so land back on the orders list rather than a per-order route.
export function MerchantNewOrderForm() {
  const router = useRouter();
  return (
    <NewOrderForm
      createEndpoint="/api/merchant/orders"
      cancelHref="/merchant"
      onCreated={() => {
        router.push("/merchant");
        router.refresh();
      }}
    />
  );
}
