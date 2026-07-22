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
  // "dot" (default) is a plain colored circle. "arrow" draws a directional
  // navigation-style arrow rotated by `heading` degrees (0=north,
  // clockwise) -- used for the rider's marker, never the delivery address.
  shape?: "dot" | "arrow";
  heading?: number | null;
  // Opt-in per marker -- only the ops "New Order" address pin sets this.
  // Rider/customer markers never do, so their behavior is unaffected.
  draggable?: boolean;
};

type LatLng = { lat: number; lng: number };

const MARKER_ANIMATION_MS = 800;
const ROTATABLE_CLASS = "rt-arrow-inner";

// Ease-out: fast start, gentle settle -- reads as a glide rather than the
// jarring snap of setting a new lat/lng instantly, and rather than a robotic
// constant-speed slide.
function easeOutQuad(t: number): number {
  return t * (2 - t);
}

// Shortest signed angular distance from `from` to `to`, e.g. 350 -> 10
// yields +20 (not -340) so a rotating arrow always turns the short way
// around instead of spinning almost a full circle.
function shortestAngleDelta(from: number, to: number): number {
  let delta = (to - from) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

function buildIconHtml(marker: MapMarker): string {
  if (marker.shape === "arrow") {
    const deg = marker.heading ?? 0;
    // Gold-ringed white badge (dark theme's rider marker) with the same
    // black chevron rotated inside it -- the ring/background is static;
    // only the inner div rotates, so animateMarkerTo's rotation logic below
    // is unaffected by this restyle.
    return `<div style="width:100%;height:100%;border-radius:50%;background:white;border:3px solid #FFD700;box-shadow:0 2px 6px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">
      <div class="${ROTATABLE_CLASS}" style="width:65%;height:65%;transform:rotate(${deg}deg);transform-origin:50% 50%;">
        <svg viewBox="0 0 24 24" width="100%" height="100%">
          <path d="M12 2 L19 21 L12 17 L5 21 Z" fill="${marker.color}" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>`;
  }
  // Teardrop map-pin shape (destination / address markers) instead of a
  // plain dot -- anchored at the bottom tip in the sizing logic below,
  // since that point is the actual geographic location, not the pin's
  // visual center.
  return `<svg viewBox="0 0 26 34" width="26" height="34">
    <path d="M13 0C6 0 1 5.5 1 12c0 8 12 22 12 22s12-14 12-22C25 5.5 20 0 13 0z" fill="${marker.color}" stroke="white" stroke-width="1.5"/>
    <circle cx="13" cy="12" r="4.5" fill="white"/>
  </svg>`;
}

function animateMarkerTo(
  marker: Leaflet.Marker,
  to: LatLng,
  rotation: { el: HTMLElement; fromDeg: number; toDeg: number } | null,
  durationMs: number,
  onFrame: (frameId: number) => void
) {
  const from = marker.getLatLng();
  const fromLat = from.lat;
  const fromLng = from.lng;
  const rotationDelta = rotation ? shortestAngleDelta(rotation.fromDeg, rotation.toDeg) : 0;
  const start = performance.now();

  function step(now: number) {
    const t = Math.min((now - start) / durationMs, 1);
    const eased = easeOutQuad(t);
    marker.setLatLng([fromLat + (to.lat - fromLat) * eased, fromLng + (to.lng - fromLng) * eased]);
    if (rotation) {
      rotation.el.style.transform = `rotate(${rotation.fromDeg + rotationDelta * eased}deg)`;
    }
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
  onMapClick,
  onMarkerDrag,
  onRouteInfo,
}: {
  markers: MapMarker[];
  // Leaflet-native order: [lat, lng] (not Mapbox's [lng, lat]).
  defaultCenter: [number, number];
  // Optional road-following route line (rider -> delivery address), drawn
  // via OSRM. Omit or pass null on either end to hide the line.
  routeFrom?: LatLng | null;
  routeTo?: LatLng | null;
  // Both opt-in, used only by the ops "New Order" address picker. Neither
  // is passed by the rider/customer pages, so clicking or dragging on
  // their maps does nothing extra.
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerDrag?: (id: string, lat: number, lng: number) => void;
  // Fires whenever the route line is (re)fetched, with the same
  // OSRM-provided travel-time estimate used to draw the line -- no
  // separate request. Called with null when the route line is hidden
  // (routeFrom/routeTo missing). Not called on ticks where the existing
  // line is kept as-is (not enough movement/time since the last fetch),
  // so the ETA refreshes on exactly the same cadence as the line itself.
  onRouteInfo?: (info: { durationSeconds: number } | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const markerRefs = useRef<Record<string, Leaflet.Marker>>({});
  const markerAnimRefs = useRef<Record<string, number>>({});
  // Refs (not the props directly) so the map-click listener and each
  // marker's dragend listener -- both attached once, at creation time --
  // always call the latest callback instead of a stale closure.
  const onMapClickRef = useRef(onMapClick);
  const onMarkerDragRef = useRef(onMarkerDrag);
  // Last commanded rotation per arrow marker, used as the animation's
  // starting angle for the next update (see shortestAngleDelta above).
  const markerHeadingRefs = useRef<Record<string, number>>({});
  // Last lat/lng this marker was actually commanded to animate towards --
  // deliberately separate from the marker's live (still-easing) visual
  // position below, so an unrelated re-render landing mid-glide (e.g. an
  // ETA fetch resolving) doesn't restart the animation over and over. That
  // restart-on-every-render bug made the marker perpetually ease toward its
  // target in ever-smaller increments instead of gliding there once.
  const markerTargetRefs = useRef<Record<string, LatLng>>({});
  // Throttle state for the continuous re-fit below, mirroring the route
  // line's own refetch throttle just above.
  const lastFitAtRef = useRef(0);
  // Real user drags fire Leaflet's own 'dragstart' event; our own
  // setView/fitBounds calls below don't. Once someone's manually panned,
  // stop auto-recentering so it doesn't fight them.
  const userPannedRef = useRef(false);
  const routeLineRef = useRef<Leaflet.Polyline | null>(null);
  const lastRouteFetchRef = useRef<{ at: number; from: LatLng | null }>({ at: 0, from: null });
  // Forces the marker effect below to re-run once the async Leaflet import
  // + map creation finish -- without this, a caller whose `markers` prop
  // doesn't change again after mount (e.g. a one-shot address preview)
  // could load before the map exists and never actually get drawn.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    onMarkerDragRef.current = onMarkerDrag;
  }, [onMarkerDrag]);

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

      // Dark-theme map: still the same free public OSM tile server (same
      // accepted-risk decision as before, see the comment above) -- a CSS
      // filter on just the tile pane renders it dark to match the rest of
      // the app, without switching tile providers. Scoped to this one pane
      // so markers/controls/route line (painted in separate panes) are
      // never affected by it.
      const tilePane = map.getPane("tilePane");
      if (tilePane) {
        tilePane.style.filter = "invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.9) saturate(0.7)";
      }

      map.on("click", (e: Leaflet.LeafletMouseEvent) => {
        onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
      });
      map.on("dragstart", () => {
        userPannedRef.current = true;
      });

      setReady(true);
    });

    return () => {
      cancelled = true;
      Object.values(markerAnimRefs.current).forEach(cancelAnimationFrame);
      markerAnimRefs.current = {};
      markerHeadingRefs.current = {};
      markerTargetRefs.current = {};
      userPannedRef.current = false;
      lastFitAtRef.current = 0;
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
        // Skip re-animating unless the commanded target actually moved --
        // e.g. right after the user's own drag already put it exactly there
        // (see dragend below), or a re-render fired for an unrelated reason
        // (ETA/speed state updating) while this marker's target hasn't
        // changed. Deliberately compares against the last *commanded*
        // target, not the marker's current mid-glide visual position --
        // otherwise every such re-render would cancel and restart the
        // animation from wherever it happened to be, which reads as the
        // marker barely creeping instead of gliding smoothly to place.
        const lastTarget = markerTargetRefs.current[marker.id];
        if (
          lastTarget &&
          Math.abs(lastTarget.lat - marker.lat) < 1e-9 &&
          Math.abs(lastTarget.lng - marker.lng) < 1e-9
        ) {
          continue;
        }
        markerTargetRefs.current[marker.id] = { lat: marker.lat, lng: marker.lng };

        const prevFrame = markerAnimRefs.current[marker.id];
        if (prevFrame) cancelAnimationFrame(prevFrame);

        let rotation: { el: HTMLElement; fromDeg: number; toDeg: number } | null = null;
        if (marker.shape === "arrow" && marker.heading != null) {
          const el = existing.getElement()?.querySelector<HTMLElement>(`.${ROTATABLE_CLASS}`);
          if (el) {
            const fromDeg = markerHeadingRefs.current[marker.id] ?? marker.heading;
            rotation = { el, fromDeg, toDeg: marker.heading };
            markerHeadingRefs.current[marker.id] = marker.heading;
          }
        }

        animateMarkerTo(
          existing,
          { lat: marker.lat, lng: marker.lng },
          rotation,
          MARKER_ANIMATION_MS,
          (frameId) => {
            markerAnimRefs.current[marker.id] = frameId;
          }
        );
      } else {
        const isArrow = marker.shape === "arrow";
        // Arrow badge is a circle, anchored at its center. The destination
        // pin is a teardrop, anchored at its bottom tip -- that point, not
        // the shape's visual center, is the actual geographic location.
        const iconSize: [number, number] = isArrow ? [32, 32] : [26, 34];
        const iconAnchor: [number, number] = isArrow ? [16, 16] : [13, 34];
        const icon = L.divIcon({
          className: "",
          html: buildIconHtml(marker),
          iconSize,
          iconAnchor,
        });
        const m = L.marker([marker.lat, marker.lng], { icon, draggable: marker.draggable ?? false }).addTo(
          map
        );
        if (marker.draggable) {
          m.on("dragend", () => {
            const pos = m.getLatLng();
            onMarkerDragRef.current?.(marker.id, pos.lat, pos.lng);
          });
        }
        markerRefs.current[marker.id] = m;
        markerTargetRefs.current[marker.id] = { lat: marker.lat, lng: marker.lng };
        if (isArrow) markerHeadingRefs.current[marker.id] = marker.heading ?? 0;
      }
    }

    // Keeps the view fit to the current markers throughout the whole
    // tracking session, not just once at mount. A one-time fit made sense
    // visually for whatever the rider's starting distance from the
    // delivery address happened to be, but it then never changed again --
    // as the rider closed in, the same frozen wide view stayed put, so a
    // real few-meters-per-tick movement kept shrinking as a fraction of an
    // unchanging frame. At a fixed zoom chosen for a multi-km starting gap,
    // that real movement -- and ordinary multi-meter GPS noise right along
    // with it -- becomes sub-pixel, which is what actually read as the
    // marker "barely moving" and "jittering": it was never an animation bug,
    // the map was just zoomed too far out for the movement to be visible.
    // Re-fitting on this same cadence lets the zoom tighten automatically as
    // the gap closes. Paused once the user manually pans (userPannedRef),
    // so this doesn't fight someone deliberately looking elsewhere.
    const now = Date.now();
    if (
      markers.length > 0 &&
      !userPannedRef.current &&
      now - lastFitAtRef.current >= ROUTE_REFETCH_MIN_INTERVAL_MS
    ) {
      lastFitAtRef.current = now;
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
      onRouteInfo?.(null);
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
            color: "#FFD700",
            weight: 4,
            opacity: 0.85,
            dashArray: "8, 8",
          }).addTo(map);
        }
        if (typeof data.durationSeconds === "number") {
          onRouteInfo?.({ durationSeconds: data.durationSeconds });
        }
      })
      .catch(() => {
        // Route line is a nice-to-have overlay -- a failed/rate-limited
        // fetch just means no line this tick, never something to surface
        // as an error to the rider/customer.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeFrom, routeTo]);

  return <div ref={containerRef} className="h-full w-full" />;
}
