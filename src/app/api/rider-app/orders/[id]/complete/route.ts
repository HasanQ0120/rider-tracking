import { NextResponse } from "next/server";
import { requireRiderApi } from "@/lib/riderApp/authGuardApi";
import { completeRiderDelivery } from "@/lib/riderApp/completeDelivery";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRiderApi(_req);
  if ("error" in auth) return auth.error;

  const { id: orderId } = await params;
  const result = await completeRiderDelivery(auth.supabase, orderId, auth.riderId);

  if (!result.ok) {
    return NextResponse.json({ status: result.code }, { status: result.status });
  }

  if (result.status === "pending_confirmation") {
    return NextResponse.json({ status: "pending_confirmation" });
  }

  return NextResponse.json({ status: "flagged", reason: result.reason });
}
