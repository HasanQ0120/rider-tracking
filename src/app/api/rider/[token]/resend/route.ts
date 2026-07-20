import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadActiveRiderToken } from "@/lib/rider/shared";
import { sendRiderLink } from "@/lib/notify";
import { RESEND_RATE_LIMIT_MINUTES } from "@/lib/config";

// No new token is generated -- the existing active token is simply resent,
// rate-limited so it can't be used to spam the rider's own phone.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceClient();
  const riderToken = await loadActiveRiderToken(supabase, token);
  if (!riderToken) {
    return NextResponse.json({ status: "invalid" }, { status: 404 });
  }

  const { data: fresh } = await supabase
    .from("tracking_tokens")
    .select("last_resend_at")
    .eq("id", riderToken.id)
    .single();

  if (fresh?.last_resend_at) {
    const elapsedMs = Date.now() - new Date(fresh.last_resend_at).getTime();
    if (elapsedMs < RESEND_RATE_LIMIT_MINUTES * 60_000) {
      return NextResponse.json({ status: "rate_limited" }, { status: 429 });
    }
  }

  const { data: rider } = await supabase
    .from("riders")
    .select("phone")
    .eq("id", riderToken.rider_id)
    .single();

  if (rider?.phone) {
    await sendRiderLink(rider.phone, riderToken.token);
  }

  await supabase
    .from("tracking_tokens")
    .update({ last_resend_at: new Date().toISOString() })
    .eq("id", riderToken.id);

  return NextResponse.json({ status: "ok" });
}
