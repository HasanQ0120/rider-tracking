import { NextResponse } from "next/server";
import { requireRiderApi } from "@/lib/riderApp/authGuardApi";
import { markRiderArrived } from "@/lib/riderApp/completeDelivery";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRiderApi(_req);
  if ("error" in auth) return auth.error;

  const { id: orderId } = await params;
  const result = await markRiderArrived(auth.supabase, orderId, auth.riderId);

  if (!result.ok) {
    return NextResponse.json({ status: result.code }, { status: result.status });
  }

  return NextResponse.json({ status: "ok" });
}
