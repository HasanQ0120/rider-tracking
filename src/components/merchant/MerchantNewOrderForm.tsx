"use client";

import { useRouter } from "next/navigation";
import { NewOrderForm } from "@/components/ops/NewOrderForm";

// Thin client wrapper: onCreated is a plain closure and can't cross the
// server/client boundary from the (server component) page, so this owns
// the post-create redirect instead -- straight into that order's own
// detail/assign page, same as ops's own default behavior, rather than
// back to the dashboard (which just cost an extra open-order-then-assign
// step for no reason).
export function MerchantNewOrderForm() {
  const router = useRouter();
  return (
    <NewOrderForm
      createEndpoint="/api/merchant/orders"
      cancelHref="/merchant"
      onCreated={(orderId) => {
        router.push(`/merchant/orders/${orderId}`);
      }}
    />
  );
}
