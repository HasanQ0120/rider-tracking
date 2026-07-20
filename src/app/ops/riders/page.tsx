import { requireOpsUser } from "@/lib/ops/authGuard";
import { createServiceClient } from "@/lib/supabase/service";
import { RidersPanel } from "@/components/ops/RidersPanel";

export default async function RidersPage() {
  await requireOpsUser();
  const supabase = createServiceClient();
  const { data: riders } = await supabase
    .from("riders")
    .select("id, name, phone, active, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-xl font-semibold text-brand-navy">Riders</h1>
      <RidersPanel initialRiders={riders ?? []} />
    </div>
  );
}
