import { NextResponse } from "next/server";
import { geocodeSearch } from "@/lib/geocode";

// Nominatim's usage policy caps requests at roughly 1/sec and requires a
// real, identifying User-Agent header -- something browser fetch() cannot
// set, which is why this proxies the call server-side instead of the client
// calling Nominatim directly (as it previously did with Mapbox's Geocoding
// API). Also why this route rate-limits itself: previously Mapbox enforced
// its own limits on our behalf; now our server is the direct caller, and
// two ops staff searching addresses close together could otherwise trip
// Nominatim's per-service cap.
//
// In-memory only -- resets on restart, doesn't share state across multiple
// instances. Fine for a single-process ops tool used by a handful of staff;
// would need a shared store (DB row/Redis) if this ever runs on more than
// one instance.
const MIN_INTERVAL_MS = 1100;
let lastRequestAt = 0;
const lastRequestByIp = new Map<string, number>();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const now = Date.now();

  const lastForIp = lastRequestByIp.get(ip) ?? 0;
  if (now - lastForIp < MIN_INTERVAL_MS || now - lastRequestAt < MIN_INTERVAL_MS) {
    return NextResponse.json({ status: "rate_limited" }, { status: 429 });
  }
  lastRequestByIp.set(ip, now);
  lastRequestAt = now;

  const results = await geocodeSearch(q);
  if (results === null) {
    return NextResponse.json({ status: "error" }, { status: 502 });
  }

  return NextResponse.json({ status: "ok", results });
}
