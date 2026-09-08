import axios from "axios";
import { getApiBaseUrl } from "./config";
import { clearPortalToken, getPortalToken } from "./token";

/**
 * Browser axios client → rider-tracking-api (Approach B).
 * Sends Authorization: Bearer <jwt> from localStorage / cookie.
 */
export const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getPortalToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Don't clear on login endpoints — invalid credentials are expected.
      const url = error.config?.url ?? "";
      if (!url.includes("/api/auth/admin/login") && !url.includes("/api/auth/merchant/login")) {
        clearPortalToken();
      }
    }
    return Promise.reject(error);
  }
);

/** Server-side axios helper with an explicit Bearer token (from cookies). */
export function apiWithToken(token: string) {
  return axios.create({
    baseURL: getApiBaseUrl(),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}
