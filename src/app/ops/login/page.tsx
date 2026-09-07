import { redirect } from "next/navigation";

export default function OpsLoginRedirect() {
  redirect("/admin/login");
}
