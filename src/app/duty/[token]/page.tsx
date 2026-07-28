import { DutyClient } from "./DutyClient";

export default async function DutyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <DutyClient token={token} />;
}
