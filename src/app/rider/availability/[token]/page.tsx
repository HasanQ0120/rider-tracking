import { AvailabilityClient } from "./AvailabilityClient";

export default async function RiderAvailabilityPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <AvailabilityClient token={token} />;
}
