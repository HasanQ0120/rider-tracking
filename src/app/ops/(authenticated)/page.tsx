import { redirect } from "next/navigation";

/** Ops portal folded into Admin — keep old bookmarks working. */
export default function OpsRootRedirect() {
  redirect("/admin");
}
