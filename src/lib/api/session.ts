import "server-only";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "./config";

export type PortalSessionClaims = {
  userId: string;
  role: "platform_admin" | "merchant" | "ops";
  tenantId?: string;
  email: string;
};

function jwtSecret(): Uint8Array {
  const raw = process.env.SESSION_JWT_SECRET;
  if (!raw) {
    throw new Error("SESSION_JWT_SECRET is not configured (must match rider-tracking-api)");
  }
  return new TextEncoder().encode(raw);
}

export async function verifyPortalToken(token: string): Promise<PortalSessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), { algorithms: ["HS256"] });
    const userId = payload.userId;
    const role = payload.role;
    const email = payload.email;
    const tenantId = payload.tenantId;
    if (typeof userId !== "string" || typeof email !== "string") return null;
    if (role !== "platform_admin" && role !== "merchant" && role !== "ops") return null;
    if (tenantId !== undefined && typeof tenantId !== "string") return null;
    return {
      userId,
      role,
      email,
      ...(typeof tenantId === "string" ? { tenantId } : {}),
    };
  } catch {
    return null;
  }
}

export async function getSessionTokenFromCookies(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export async function getVerifiedPortalSession(): Promise<PortalSessionClaims | null> {
  const token = await getSessionTokenFromCookies();
  if (!token) return null;
  return verifyPortalToken(token);
}
