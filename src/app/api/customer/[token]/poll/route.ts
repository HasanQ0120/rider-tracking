import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrdersAhead } from "@/lib/orderQueue";

// Without this, Next.js can serve a cached response for this GET route
// (its Full Route Cache applies to GET handlers by default) and/or
// Vercel's edge network can cache it too -- either would mean the customer
// keeps re-polling into a stale snapshot instead of the rider's actual
// current position, however often the client asks. force-dynamic plus the
// explicit no-store header below close both paths.
export const dynamic = "force-dynamic";

// Frequent, lightweight polling endpoint for the customer page -- replaces
// an earlier direct-Supabase-Realtime subscription that depended on the
// browser holding a custom-signed JWT. That JWT was signed with the legacy
// HS256 shared-secret scheme (SUPABASE_JWT_SECRET), but this project issues
// tokens with the newer asymmetric ES256 signing keys, so Realtime rejected
// every one of those tokens outright (confirmed via Supabase's own Realtime
// logs: "JwtSignatureError: Failed to validate JWT signature") -- the
// rider's marker could never appear on the customer's page as a result.
// Polling through our own service-role-backed API sidesteps that fragility
// entirely and matches how every other route in this app already works;
// a customer waiting on a slowly-moving delivery marker doesn't need
// sub-second push latency for this to feel live.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: tokenRow } = await supabase
    .from("tracking_tokens")
    .select("id, order_id, active, expires_at")
    .eq("token", token)
    .eq("type", "customer")
    .eq("active", true)
    .maybeSingle();

  const notExpired =
    tokenRow && (!tokenRow.expires_at || new Date(tokenRow.expires_at) > new Date());
  if (!tokenRow || !notExpired) {
    return NextResponse.json({ status: "invalid" }, { status: 404 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, status, rider_arrived_at, tracking_expired_unresolved, delivery_confirmed_by, review_flag_reason, assigned_rider_id"
    )
    .eq("id", tokenRow.order_id)
    .single();

  const ordersAhead = order ? await getOrdersAhead(supabase, order) : 0;

  // While queued behind another of the same rider's deliveries, never fetch
  // (let alone return) the rider's actual current position -- the queued
  // screen has no map to put it on, and this keeps that position from ever
  // reaching a queued customer's browser at all, not just going unrendered.
  const { data: loc } =
    ordersAhead > 0
      ? { data: null }
      : await supabase
          .from("current_locations")
          .select("lat, lng, accuracy_m, heading, speed_kmh, recorded_at")
          .eq("order_id", tokenRow.order_id)
          .maybeSingle();

  return NextResponse.json(
    { status: "ok", order: order ? { ...order, orders_ahead: ordersAhead } : order, loc },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
