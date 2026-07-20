import { RiderTrackingClient } from "./RiderTrackingClient";

export default async function RiderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <RiderTrackingClient token={token} />;
}
