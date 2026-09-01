import "server-only";
import { SignJWT, jwtVerify } from "jose";

export type RiderSessionClaims = {
  riderId: string;
  tenantId: string;
  phone: string;
};

const TOKEN_TTL = "30d";

function jwtSecret(): Uint8Array {
  const raw = process.env.RIDER_APP_JWT_SECRET;
  if (!raw) {
    throw new Error("RIDER_APP_JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(raw);
}

export async function signRiderSession(claims: RiderSessionClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(jwtSecret());
}

export async function verifyRiderSession(token: string): Promise<RiderSessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), { algorithms: ["HS256"] });
    const riderId = payload.riderId;
    const tenantId = payload.tenantId;
    const phone = payload.phone;
    if (typeof riderId !== "string" || typeof tenantId !== "string" || typeof phone !== "string") {
      return null;
    }
    return { riderId, tenantId, phone };
  } catch {
    return null;
  }
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}
