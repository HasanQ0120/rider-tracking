import "server-only";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { bearerToken, verifyRiderSession, type RiderSessionClaims } from "@/lib/riderApp/session";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthenticatedRider = RiderSessionClaims & {
  supabase: SupabaseClient;
  rider: {
    id: string;
    name: string;
    phone: string;
    license_plate: string | null;
    active: boolean;
    available: boolean;
  };
};

export async function requireRiderApi(
  req: Request
): Promise<AuthenticatedRider | { error: NextResponse }> {
  const token = bearerToken(req);
  if (!token) {
    return { error: NextResponse.json({ status: "unauthorized" }, { status: 401 }) };
  }

  const claims = await verifyRiderSession(token);
  if (!claims) {
    return { error: NextResponse.json({ status: "unauthorized" }, { status: 401 }) };
  }

  const supabase = createServiceClient();
  const { data: rider, error } = await supabase
    .from("riders")
    .select("id, tenant_id, name, phone, license_plate, active, available")
    .eq("id", claims.riderId)
    .eq("tenant_id", claims.tenantId)
    .maybeSingle();

  if (error || !rider || !rider.active) {
    return { error: NextResponse.json({ status: "unauthorized" }, { status: 401 }) };
  }

  return {
    ...claims,
    supabase,
    rider: {
      id: rider.id,
      name: rider.name,
      phone: rider.phone,
      license_plate: rider.license_plate,
      active: rider.active,
      available: rider.available,
    },
  };
}
