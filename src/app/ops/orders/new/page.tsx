import { requireOpsUser } from "@/lib/ops/authGuard";
import { NewOrderForm } from "@/components/ops/NewOrderForm";

export default async function NewOrderPage() {
  await requireOpsUser();
  return (
    <div className="mx-auto max-w-lg animate-slide-up">
      <h1 className="mb-6 text-2xl font-semibold text-brand-navy">New Order</h1>
      <NewOrderForm />
    </div>
  );
}
