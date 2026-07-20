import { CustomerTrackingClient } from "./CustomerTrackingClient";

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CustomerTrackingClient token={token} />;
}
