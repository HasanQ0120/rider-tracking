import "server-only";
import { redirect } from "next/navigation";
import type { AxiosInstance } from "axios";
import { apiWithToken } from "./client";
import { getSessionTokenFromCookies } from "./session";

/** Server Components / RSC: axios client authenticated with portal cookie JWT. */
export async function serverApi(loginPath = "/admin/login"): Promise<AxiosInstance> {
  const token = await getSessionTokenFromCookies();
  if (!token) redirect(loginPath);
  return apiWithToken(token);
}
