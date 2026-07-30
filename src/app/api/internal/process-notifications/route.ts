import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendRiderLink, sendRiderPin } from "@/lib/notify";

// Bridges the pure-SQL cron reissue path (which has no live HTTP request to
// send from) back into the notification abstraction. Intended to be hit
// periodically by an external scheduler (Vercel Cron in production); safe
// to call manually/repeatedly in dev since it only sends rows with
// sent_at IS NULL and marks them sent immediately after.
export async function POST(req: Request) {
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: pending } = await supabase
    .from("pending_notifications")
    .select("id, order_id, to_phone, message")
    .is("sent_at", null)
    .order("created_at", { ascending: true })
    .limit(50);

  // Looked up separately rather than joined, to sidestep Supabase's
  // object-vs-array return shape for a to-one join -- most batches only
  // touch a handful of distinct orders anyway.
  const orderIds = [...new Set((pending ?? []).map((r) => r.order_id))];
  const { data: orders } = orderIds.length
    ? await supabase.from("orders").select("id, customer_name").in("id", orderIds)
    : { data: [] as { id: string; customer_name: string }[] };
  const nameByOrderId = new Map((orders ?? []).map((o) => [o.id, o.customer_name]));

  let sent = 0;
  for (const row of pending ?? []) {
    const customerName = nameByOrderId.get(row.order_id) ?? "your delivery";
    if (row.message.startsWith("link:")) {
      await sendRiderLink(row.to_phone, row.message.slice("link:".length), customerName);
    } else if (row.message.startsWith("pin:")) {
      await sendRiderPin(row.to_phone, row.message.slice("pin:".length), customerName);
    }
    const { error: markSentError } = await supabase
      .from("pending_notifications")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", row.id);
    if (markSentError) {
      // Left with sent_at still null -- will be silently retried (a
      // possible duplicate SMS) rather than lost, but log it so a
      // persistently-stuck row is actually visible somewhere.
      console.error("[process-notifications] failed to mark row sent", row.id, markSentError);
      continue;
    }
    sent += 1;
  }

  return NextResponse.json({ status: "ok", sent });
}
