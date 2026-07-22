import { NextResponse } from "next/server";

// Proxies OSRM's public demo routing server (router.project-osrm.org).
// That server is explicitly a best-effort demo instance, not meant for
// heavy/production traffic and with no SLA -- same category of accepted
// risk as the raw OSM tile server this app already uses (see
// TrackingMap.tsx / PROGRESS.md). Proxying server-side lets this route
// throttle itself the same way /api/geocode does for Nominatim, so a
// tracking page polling every few seconds doesn't hammer the shared
// public resource -- the client-side throttle in TrackingMap.tsx (only
// refetch on meaningful movement) is the primary defense; this is a
// second layer in case that's ever bypassed.
const MIN_INTERVAL_MS = 1000;
let lastRequestAt = 0;
const lastRequestByIp = new Map<string, number>();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fromLat = parseFloat(searchParams.get("fromLat") ?? "");
  const fromLng = parseFloat(searchParams.get("fromLng") ?? "");
  const toLat = parseFloat(searchParams.get("toLat") ?? "");
  const toLng = parseFloat(searchParams.get("toLng") ?? "");

  if ([fromLat, fromLng, toLat, toLng].some((n) => Number.isNaN(n))) {
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

  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) {
    return NextResponse.json({ status: "error" }, { status: 502 });
  }

  const data = await res.json();
  const route = data.routes?.[0];
  const coords: [number, number][] | undefined = route?.geometry?.coordinates;
  if (!coords) {
    return NextResponse.json({ status: "no_route" });
  }

  // OSRM returns [lng, lat] pairs; flip to the [lat, lng] convention this
  // app standardized on for Leaflet.
  const points = coords.map(([lng, lat]) => ({ lat, lng }));
  // OSRM already estimates travel time (seconds) for this same route call --
  // reuse it for the ETA display instead of a second request/service.
  const durationSeconds: number | null =
    typeof route.duration === "number" ? route.duration : null;
  return NextResponse.json({ status: "ok", points, durationSeconds });
}
