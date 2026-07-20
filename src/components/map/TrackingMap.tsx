"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

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
  defaultCenter: [number, number];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRefs = useRef<Record<string, mapboxgl.Marker>>({});
  const hasFitRef = useRef(false);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || !containerRef.current) return;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: defaultCenter,
      zoom: 14,
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRefs.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const marker of markers) {
      const existing = markerRefs.current[marker.id];
      if (existing) {
        existing.setLngLat([marker.lng, marker.lat]);
      } else {
        const el = document.createElement("div");
        el.style.width = "18px";
        el.style.height = "18px";
        el.style.borderRadius = "50%";
        el.style.background = marker.color;
        el.style.border = "3px solid white";
        el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.4)";
        const m = new mapboxgl.Marker({ element: el })
          .setLngLat([marker.lng, marker.lat])
          .addTo(map);
        markerRefs.current[marker.id] = m;
      }
    }

    if (!hasFitRef.current && markers.length > 0) {
      hasFitRef.current = true;
      if (markers.length === 1) {
        map.setCenter([markers[0].lng, markers[0].lat]);
      } else {
        const bounds = new mapboxgl.LngLatBounds();
        markers.forEach((m) => bounds.extend([m.lng, m.lat]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 16 });
      }
    }
  }, [markers]);

  return <div ref={containerRef} className="h-full w-full" />;
}
