import { requireOpsUser } from "@/lib/ops/authGuard";
import { NewOrderForm } from "@/components/ops/NewOrderForm";

export default async function NewOrderPage() {
  await requireOpsUser();
  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-xl font-semibold text-brand-navy">New Order</h1>
      <NewOrderForm />
    </div>
  );
}
