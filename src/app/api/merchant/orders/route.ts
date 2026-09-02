import { NextResponse } from "next/server";

/** Order creation is API-only (POST /api/v1/orders). Dashboard is read-only. */
export async function POST() {
  return NextResponse.json(
    {
      status: "deprecated",
      message: "Create orders via POST /api/v1/orders with your API key.",
    },
    { status: 410 }
  );
}
