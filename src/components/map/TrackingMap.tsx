"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapMarker = {
  id: string;
  lng: number;
  lat: number;
  color: string;
  label?: string;
};

// Thin wrapper: the backend/Realtime pipeline only ever hands this
// component {lat,lng} pairs. This is the only place that turns a
// coordinate into something drawn on screen.
export function TrackingMap({
  markers,
  defaultCenter,
}: {
  markers: MapMarker[];
  // Leaflet-native order: [lat, lng] (not Mapbox's [lng, lat]).
  defaultCenter: [number, number];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const markerRefs = useRef<Record<string, Leaflet.Marker>>({});
  const hasFitRef = useRef(false);
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
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      markerRefs.current = {};
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
        existing.setLatLng([marker.lat, marker.lng]);
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

  return <div ref={containerRef} className="h-full w-full" />;
}
