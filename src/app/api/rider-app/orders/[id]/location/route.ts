import { NextResponse } from "next/server";
import { requireRiderApi } from "@/lib/riderApp/authGuardApi";
import { recordRiderLocation } from "@/lib/riderApp/location";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRiderApi(req);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const { lat, lng, accuracy_m, session_id } = body as {
    lat?: unknown;
    lng?: unknown;
    accuracy_m?: unknown;
    session_id?: unknown;
  };

  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    typeof accuracy_m !== "number" ||
    typeof session_id !== "string" ||
    !session_id
  ) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const { id: orderId } = await params;
  const result = await recordRiderLocation(auth.supabase, orderId, auth.riderId, {
    lat,
    lng,
    accuracy_m,
    session_id,
  });

  if (!result.ok) {
    const httpStatus = result.status;
    return NextResponse.json({ status: result.code }, { status: httpStatus });
  }

  return NextResponse.json({
    status: "ok",
    speedImplausible: result.speedImplausible,
    heading: result.heading,
    speedKmh: result.speedKmh,
  });
}
