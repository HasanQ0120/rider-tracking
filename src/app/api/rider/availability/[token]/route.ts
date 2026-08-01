import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// Deliberately minimal, unlike the per-order rider routes: no PIN, no
// device-lock, no session table. This token only ever flips one boolean on
// `riders`, so possessing the link is treated as sufficient authorization --
// there's nothing sensitive to protect beyond it.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();
  const { data: rider } = await supabase
    .from("riders")
    .select("name, available")
    .eq("availability_token", token)
    .maybeSingle();

  if (!rider) return NextResponse.json({ status: "invalid" }, { status: 404 });
  return NextResponse.json({ status: "ok", name: rider.name, available: rider.available });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.available !== "boolean") {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: rider, error } = await supabase
    .from("riders")
    .update({ available: body.available })
    .eq("availability_token", token)
    .select("name, available")
    .maybeSingle();

  if (error || !rider) return NextResponse.json({ status: "invalid" }, { status: 404 });
  return NextResponse.json({ status: "ok", name: rider.name, available: rider.available });
}
