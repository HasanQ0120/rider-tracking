"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { haversineMeters } from "@/lib/geo";
import { ROUTE_REFETCH_MIN_DISTANCE_M, ROUTE_REFETCH_MIN_INTERVAL_MS } from "@/lib/config";

export type MapMarker = {
  id: string;
  lng: number;
  lat: number;
  color: string;
  label?: string;
};

type LatLng = { lat: number; lng: number };

const MARKER_ANIMATION_MS = 800;

// Ease-out: fast start, gentle settle -- reads as a glide rather than the
// jarring snap of setting a new lat/lng instantly, and rather than a robotic
// constant-speed slide.
function easeOutQuad(t: number): number {
  return t * (2 - t);
}

function animateMarkerTo(
  marker: Leaflet.Marker,
  to: LatLng,
  durationMs: number,
  onFrame: (frameId: number) => void
) {
  const from = marker.getLatLng();
  const fromLat = from.lat;
  const fromLng = from.lng;
  const start = performance.now();

  function step(now: number) {
    const t = Math.min((now - start) / durationMs, 1);
    const eased = easeOutQuad(t);
    marker.setLatLng([fromLat + (to.lat - fromLat) * eased, fromLng + (to.lng - fromLng) * eased]);
    if (t < 1) {
      onFrame(requestAnimationFrame(step));
    }
  }
  onFrame(requestAnimationFrame(step));
}

// Thin wrapper: the backend/Realtime pipeline only ever hands this
// component {lat,lng} pairs. This is the only place that turns a
// coordinate into something drawn on screen.
export function TrackingMap({
  markers,
  defaultCenter,
  routeFrom,
  routeTo,
}: {
  markers: MapMarker[];
  // Leaflet-native order: [lat, lng] (not Mapbox's [lng, lat]).
  defaultCenter: [number, number];
  // Optional road-following route line (rider -> delivery address), drawn
  // via OSRM. Omit or pass null on either end to hide the line.
  routeFrom?: LatLng | null;
  routeTo?: LatLng | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const markerRefs = useRef<Record<string, Leaflet.Marker>>({});
  const markerAnimRefs = useRef<Record<string, number>>({});
  const hasFitRef = useRef(false);
  const routeLineRef = useRef<Leaflet.Polyline | null>(null);
  const lastRouteFetchRef = useRef<{ at: number; from: LatLng | null }>({ at: 0, from: null });
  // Forces the marker effect below to re-run once the async Leaflet import
  // + map creation finish -- without this, a caller whose `markers` prop
  // doesn't change again after mount (e.g. a one-shot address preview)
  // could load before the map exists and never actually get drawn.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    // Leaflet touches `window` at module-evaluation time, which crashes
    // during Next.js's server-side render of this "use client" component.
    // A dynamic import here only ever runs inside this browser-only effect,
    // never during SSR.
    import("leaflet").then((mod) => {
      if (cancelled || !containerRef.current) return;
      const L = mod.default ?? mod;
      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        center: defaultCenter,
        zoom: 14,
        attributionControl: true,
      });
      mapRef.current = map;

      // Raw public OSM tile server, used with a deliberate, accepted risk of
      // unannounced blocking (no SLA) -- see the "Swap Mapbox -> Leaflet"
      // plan/PROGRESS.md for why. Not a bug to "fix" by routing through a
      // paid host later without discussion.
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      setReady(true);
    });

    return () => {
      cancelled = true;
      Object.values(markerAnimRefs.current).forEach(cancelAnimationFrame);
      markerAnimRefs.current = {};
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      markerRefs.current = {};
      routeLineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    for (const marker of markers) {
      const existing = markerRefs.current[marker.id];
      if (existing) {
        const prevFrame = markerAnimRefs.current[marker.id];
        if (prevFrame) cancelAnimationFrame(prevFrame);
        animateMarkerTo(existing, { lat: marker.lat, lng: marker.lng }, MARKER_ANIMATION_MS, (frameId) => {
          markerAnimRefs.current[marker.id] = frameId;
        });
      } else {
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:18px;height:18px;border-radius:50%;background:${marker.color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        const m = L.marker([marker.lat, marker.lng], { icon }).addTo(map);
        markerRefs.current[marker.id] = m;
      }
    }

    if (!hasFitRef.current && markers.length > 0) {
      hasFitRef.current = true;
      if (markers.length === 1) {
        map.setView([markers[0].lat, markers[0].lng], map.getZoom());
      } else {
        const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
      }
    }
  }, [markers, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    if (!routeFrom || !routeTo) {
      routeLineRef.current?.remove();
      routeLineRef.current = null;
      lastRouteFetchRef.current = { at: 0, from: null };
      return;
    }

    const last = lastRouteFetchRef.current;
    const now = Date.now();
    const movedEnoughOrFirstFetch =
      !last.from || haversineMeters(last.from.lat, last.from.lng, routeFrom.lat, routeFrom.lng) >= ROUTE_REFETCH_MIN_DISTANCE_M;
    const longEnoughSinceLastFetch = now - last.at >= ROUTE_REFETCH_MIN_INTERVAL_MS;
    // Existing line already drawn and nothing's moved enough to justify a
    // refetch -- leave it as-is rather than hit OSRM again.
    if (routeLineRef.current && !(movedEnoughOrFirstFetch && longEnoughSinceLastFetch)) {
      return;
    }

    lastRouteFetchRef.current = { at: now, from: routeFrom };
    const params = new URLSearchParams({
      fromLat: String(routeFrom.lat),
      fromLng: String(routeFrom.lng),
      toLat: String(routeTo.lat),
      toLng: String(routeTo.lng),
    });
    fetch(`/api/directions?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== "ok" || !mapRef.current) return;
        const latLngs: [number, number][] = data.points.map((p: LatLng) => [p.lat, p.lng]);
        if (routeLineRef.current) {
          routeLineRef.current.setLatLngs(latLngs);
        } else {
          routeLineRef.current = L.polyline(latLngs, {
            color: "#0A192F",
            weight: 4,
            opacity: 0.65,
          }).addTo(map);
        }
      })
      .catch(() => {
        // Route line is a nice-to-have overlay -- a failed/rate-limited
        // fetch just means no line this tick, never something to surface
        // as an error to the rider/customer.
      });
  }, [routeFrom, routeTo]);

  return <div ref={containerRef} className="h-full w-full" />;
}
