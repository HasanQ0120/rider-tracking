"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { TrackingMap, type MapMarker } from "@/components/map/TrackingMap";
import { CUSTOMER_POLL_INTERVAL_MS, MARKER_COLOR_TRACKED_RIDER } from "@/lib/config";

type Snapshot = {
  loc: { lat: number; lng: number; recordedAt: string } | null;
  isStale: boolean;
  pickup: { lat: number; lng: number } | null;
};

export function AllRidersMapPanel({
  riders,
  endpointBase,
  onClose,
  onSelectRider,
}: {
  riders: { id: string; name: string }[];
  endpointBase: string;
  onClose: () => void;
  onSelectRider: (riderId: string) => void;
}) {
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSelectRiderRef = useRef(onSelectRider);
  onSelectRiderRef.current = onSelectRider;

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(`${endpointBase}/locations`, { cache: "no-store" });
        const data = await res.json();
        if (data.status === "ok") setSnapshots(data.snapshots);
      } catch {
        // Transient fetch failure -- keep showing the last good snapshot.
      }
    }

    void poll();
    pollTimerRef.current = setInterval(poll, CUSTOMER_POLL_INTERVAL_MS);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [endpointBase]);

  const markers: MapMarker[] = riders.flatMap((r) => {
    const snapshot = snapshots?.[r.id];
    if (!snapshot) return [];
    if (snapshot.loc) {
      return [
        {
          id: r.id,
          lat: snapshot.loc.lat,
          lng: snapshot.loc.lng,
          color: MARKER_COLOR_TRACKED_RIDER,
          label: snapshot.isStale ? `${r.name} — GPS signal lost` : r.name,
        },
      ];
    }
    if (snapshot.pickup) {
      return [
        {
          id: r.id,
          lat: snapshot.pickup.lat,
          lng: snapshot.pickup.lng,
          color: MARKER_COLOR_TRACKED_RIDER,
          label: `${r.name} — at pickup`,
        },
      ];
    }
    return [];
  });

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-surface-raised">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="font-medium text-white">All Riders</p>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      </div>
      <div className="relative flex-1">
        {!snapshots ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="h-6 w-6 text-white/50" />
          </div>
        ) : markers.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/50">
            No location data available for any rider.
          </div>
        ) : (
          <TrackingMap
            markers={markers}
            defaultCenter={[markers[0].lat, markers[0].lng]}
            onMarkerClick={(id) => onSelectRiderRef.current(id)}
          />
        )}
      </div>
    </div>
  );
}
