import { redirect } from "next/navigation";

export default function OpsOrdersRedirect() {
  redirect("/admin/tenants");
}
