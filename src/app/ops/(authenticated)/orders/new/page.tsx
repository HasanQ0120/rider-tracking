import { redirect } from "next/navigation";

export default function OpsNewOrderRedirect() {
  redirect("/admin/tenants");
}
