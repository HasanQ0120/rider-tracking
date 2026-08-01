import "server-only";

export type GeocodeResult = { placeName: string; lat: number; lng: number };

// Shared core of the Nominatim lookup used both by the interactive address
// search (/api/geocode, which layers its own per-IP rate limiting on top)
// and by any server-side caller that needs a best-effort geocode with no
// separate HTTP round-trip. Returns null specifically on a request failure
// (network error, non-OK response) -- distinct from a successful search
// that simply found zero matches (empty array) -- so callers can tell "the
// service is down" apart from "nothing matched" if that distinction
// matters to them.
export async function geocodeSearch(query: string): Promise<GeocodeResult[] | null> {
  const userAgent =
    process.env.NOMINATIM_USER_AGENT ?? "RiderTracking/1.0 (ops contact: not-configured)";
  // Short/ambiguous queries (e.g. a housing-scheme name that exists in
  // several cities) can otherwise match a same-named place in an entirely
  // different region -- restricting to the actual country(ies) of
  // operation is the single biggest accuracy improvement Nominatim's API
  // supports for this. Comma-separated ISO 3166-1 alpha-2 codes; unset
  // means unrestricted (global) search.
  const countryCodes = process.env.NOMINATIM_COUNTRY_CODES;
  const countryParam = countryCodes ? `&countrycodes=${encodeURIComponent(countryCodes)}` : "";

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1${countryParam}`,
      { headers: { "User-Agent": userAgent } }
    );
    if (!res.ok) return null;
    const data: { display_name: string; lat: string; lon: string }[] = await res.json();
    return data.map((r) => ({ placeName: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) }));
  } catch {
    return null;
  }
}

// Convenience wrapper for callers that just want a single best-effort
// match (e.g. auto-geocoding an inbound API order's delivery_address) --
// null covers both "the lookup failed" and "nothing matched" uniformly,
// since callers using this one only ever care about "did we get a point
// to use or not."
export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const results = await geocodeSearch(query);
  return results?.[0] ?? null;
}
