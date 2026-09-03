import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveTenantByApiKey, type ApiTenant } from "@/lib/tenant/resolveApiKey";

const MIN_INTERVAL_MS = 500;
const lastRequestByTenant = new Map<string, number>();

const SOURCE_MAX_LEN = 64;
const EXTERNAL_ORDER_ID_MAX_LEN = 128;

export type V1ApiContext = {
  tenant: ApiTenant;
  service: SupabaseClient;
};

export function parseBearerApiKey(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const key = authHeader.slice("Bearer ".length).trim();
  return key || null;
}

/** Normalize optional integration source (golootlo, pos, website, …). */
export function normalizeIntegrationSource(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (!trimmed) return null;
  if (trimmed.length > SOURCE_MAX_LEN) return null;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(trimmed)) return null;
  return trimmed;
}

export function normalizeExternalOrderId(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > EXTERNAL_ORDER_ID_MAX_LEN) return null;
  return trimmed;
}

/**
 * Resolves API-key auth + per-tenant rate limit for /api/v1/* routes.
 * Returns either a ready context or a NextResponse error to return as-is.
 */
export async function requireV1ApiKey(req: Request): Promise<V1ApiContext | { error: NextResponse }> {
  const rawKey = parseBearerApiKey(req);
  const service = createServiceClient();
  const tenant = await resolveTenantByApiKey(service, rawKey);
  if (!tenant) {
    return { error: NextResponse.json({ status: "unauthorized" }, { status: 401 }) };
  }

  const now = Date.now();
  const lastForTenant = lastRequestByTenant.get(tenant.id) ?? 0;
  if (now - lastForTenant < MIN_INTERVAL_MS) {
    return { error: NextResponse.json({ status: "rate_limited" }, { status: 429 }) };
  }
  lastRequestByTenant.set(tenant.id, now);

  return { tenant, service };
}
