import "server-only";
import { hashPin, generateAvailabilityToken } from "@/lib/tokens";
import type { ParsedRider } from "@/lib/riderValidation";

export type RiderInsertRow = {
  tenant_id: string;
  name: string;
  phone: string;
  license_plate: string;
  availability_token: string;
  login_pin_hash: string;
};

export async function buildRiderInsertRows(
  tenantId: string,
  riders: ParsedRider[]
): Promise<RiderInsertRow[]> {
  return Promise.all(
    riders.map(async (r) => ({
      tenant_id: tenantId,
      name: r.name,
      phone: r.phone,
      license_plate: r.license_plate,
      availability_token: generateAvailabilityToken(),
      login_pin_hash: await hashPin(r.login_pin),
    }))
  );
}
