import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// Resolves the rider-initiated confirmation prompt. Only meaningful while
// the order is actually in pending_confirmation -- if it's already been
// resolved (by the 30-minute timeout, or a duplicate tap), this is a
// harmless no-op rather than double-processing.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { response } = await req.json();

  if (response !== "yes" && response !== "no") {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: tokenRow } = await supabase
    .from("tracking_tokens")
    .select("id, order_id, active")
    .eq("token", token)
    .eq("type", "customer")
    .eq("active", true)
    .maybeSingle();

  if (!tokenRow) {
    return NextResponse.json({ status: "invalid" }, { status: 404 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", tokenRow.order_id)
    .single();

  if (!order || order.status !== "pending_confirmation") {
    return NextResponse.json({ status: "already_resolved" });
  }

  if (response === "yes") {
    await supabase.rpc("mark_order_delivered", {
      p_order_id: order.id,
      p_confirmed_by: "customer_confirmed",
    });
    return NextResponse.json({ status: "ok", resolvedStatus: "delivered" });
  }

  await supabase.rpc("flag_order_for_review", {
    p_order_id: order.id,
    p_reason: "customer_rejected",
  });
  return NextResponse.json({ status: "ok", resolvedStatus: "flagged_review" });
}
