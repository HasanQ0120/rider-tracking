import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function OpsOrderDetailRedirect({ params }: PageProps) {
  const { id } = await params;
  // Without tenant context, land on tenant list; operators pick the merchant.
  void id;
  redirect("/admin/tenants");
}
