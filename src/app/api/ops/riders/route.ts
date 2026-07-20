import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOpsUserApi } from "@/lib/ops/authGuardApi";

export async function GET() {
  const guard = await requireOpsUserApi();
  if ("error" in guard) return guard.error;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("riders")
    .select("id, name, phone, active, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });
  return NextResponse.json({ riders: data });
}

export async function POST(req: Request) {
  const guard = await requireOpsUserApi();
  if ("error" in guard) return guard.error;

  const { name, phone } = await req.json();
  if (!name || !phone) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("riders")
    .insert({ name, phone })
    .select()
    .single();

  if (error) return NextResponse.json({ status: "error" }, { status: 500 });
  return NextResponse.json({ rider: data });
}
