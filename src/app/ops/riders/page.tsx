import { requireOpsUser } from "@/lib/ops/authGuard";
import { createServiceClient } from "@/lib/supabase/service";
import { RidersPanel } from "@/components/ops/RidersPanel";

export default async function RidersPage() {
  await requireOpsUser();
  const supabase = createServiceClient();
  const { data: riders } = await supabase
    .from("riders")
    .select("id, name, phone, license_plate, active, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-lg animate-slide-up">
      <h1 className="mb-6 text-2xl font-semibold text-brand-navy">Riders</h1>
      <RidersPanel initialRiders={riders ?? []} />
    </div>
  );
}
