export type TenantRow = {
  id: string;
  merchant_id: string;
  name: string;
  active: boolean;
  suspended_at: string | null;
  contact_email: string | null;
  api_key_prefix: string | null;
  auth_user_id: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  webhook_url: string | null;
  auto_assign_enabled: boolean;
  created_at: string;
};

export const TENANT_LIST_SELECT =
  "id, merchant_id, name, active, suspended_at, contact_email, api_key_prefix, auth_user_id, created_at";

export const TENANT_DETAIL_SELECT =
  "id, merchant_id, name, active, suspended_at, contact_email, api_key_prefix, auth_user_id, logo_url, primary_color, secondary_color, accent_color, webhook_url, auto_assign_enabled, created_at";

export function tenantStatusLabel(tenant: Pick<TenantRow, "active" | "suspended_at">): string {
  if (tenant.suspended_at) return "Suspended";
  if (!tenant.active) return "Inactive";
  return "Active";
}
