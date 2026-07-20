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
    .select("id, to_phone, message")
    .is("sent_at", null)
    .order("created_at", { ascending: true })
    .limit(50);

  let sent = 0;
  for (const row of pending ?? []) {
    if (row.message.startsWith("link:")) {
      await sendRiderLink(row.to_phone, row.message.slice("link:".length));
    } else if (row.message.startsWith("pin:")) {
      await sendRiderPin(row.to_phone, row.message.slice("pin:".length));
    }
    await supabase
      .from("pending_notifications")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", row.id);
    sent += 1;
  }

  return NextResponse.json({ status: "ok", sent });
}
