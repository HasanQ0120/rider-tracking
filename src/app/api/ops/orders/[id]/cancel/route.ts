import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOpsUserApi } from "@/lib/ops/authGuardApi";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireOpsUserApi();
  if ("error" in guard) return guard.error;
  const { id: orderId } = await params;

  const supabase = createServiceClient();
  await supabase.rpc("cancel_order", { p_order_id: orderId });

  return NextResponse.json({ status: "ok" });
}
