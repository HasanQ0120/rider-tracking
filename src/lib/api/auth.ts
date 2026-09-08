import { api } from "./client";
import { clearPortalToken, setPortalToken } from "./token";

export type PortalUser = {
  id: string;
  email: string;
  role: "platform_admin" | "merchant" | "ops";
  tenant_id?: string | null;
  merchant_id?: string | null;
};

type LoginOk = {
  status: "ok";
  token: string;
  user: PortalUser;
};

export async function loginAdmin(email: string, password: string): Promise<LoginOk> {
  const { data } = await api.post<LoginOk>("/api/auth/admin/login", { email, password });
  if (data.status !== "ok" || !data.token) {
    throw new Error("Login failed");
  }
  setPortalToken(data.token);
  return data;
}

export async function loginMerchant(merchantId: string, password: string): Promise<LoginOk> {
  const { data } = await api.post<LoginOk>("/api/auth/merchant/login", {
    merchant_id: merchantId,
    password,
  });
  if (data.status !== "ok" || !data.token) {
    throw new Error("Login failed");
  }
  setPortalToken(data.token);
  return data;
}

export async function logoutPortal(): Promise<void> {
  try {
    await api.post("/api/auth/logout");
  } catch {
    // Still clear local session even if API is unreachable.
  } finally {
    clearPortalToken();
  }
}

export async function fetchMe(): Promise<PortalUser> {
  const { data } = await api.get<{ status: string; user: PortalUser }>("/api/auth/me");
  if (data.status !== "ok") throw new Error("unauthorized");
  return data.user;
}
