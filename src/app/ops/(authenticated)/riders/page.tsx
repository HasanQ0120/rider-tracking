import { redirect } from "next/navigation";

export default function OpsRidersRedirect() {
  redirect("/admin/tenants");
}
