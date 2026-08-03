"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { TrackingMap, type MapMarker } from "@/components/map/TrackingMap";
import { CUSTOMER_POLL_INTERVAL_MS, MARKER_COLOR_TRACKED_RIDER } from "@/lib/config";

type Snapshot = {
  riderName: string;
  loc: { lat: number; lng: number; recordedAt: string } | null;
  isStale: boolean;
  pickup: { lat: number; lng: number } | null;
};

export function RiderLocationPanel({
  riderId,
  riderName,
  endpointBase,
  onClose,
}: {
  riderId: string;
  riderName: string;
  endpointBase: string;
  onClose: () => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [invalid, setInvalid] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSnapshot(null);
    setInvalid(false);

    async function poll() {
      try {
        const res = await fetch(`${endpointBase}/${riderId}/location`, { cache: "no-store" });
        const data = await res.json();
        if (data.status !== "ok") {
          setInvalid(true);
          return;
        }
        setSnapshot(data);
      } catch {
        // Transient fetch failure -- keep showing the last good snapshot
        // rather than flashing an error on a single dropped poll.
      }
    }

    void poll();
    pollTimerRef.current = setInterval(poll, CUSTOMER_POLL_INTERVAL_MS);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [riderId, endpointBase]);

  const marker: MapMarker | null = snapshot?.loc
    ? {
        id: "rider",
        lat: snapshot.loc.lat,
        lng: snapshot.loc.lng,
        color: MARKER_COLOR_TRACKED_RIDER,
        label: snapshot.isStale ? "GPS signal lost — last known location" : undefined,
      }
    : snapshot?.pickup
      ? {
          id: "rider",
          lat: snapshot.pickup.lat,
          lng: snapshot.pickup.lng,
          color: MARKER_COLOR_TRACKED_RIDER,
          label: "Last known: at pickup location",
        }
      : null;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-surface-raised">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="font-medium text-white">{riderName}</p>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      </div>
      <div className="relative flex-1">
        {invalid ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/50">
            Couldn&apos;t load this rider&apos;s location.
          </div>
        ) : !snapshot ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="h-6 w-6 text-white/50" />
          </div>
        ) : marker ? (
          <TrackingMap markers={[marker]} defaultCenter={[marker.lat, marker.lng]} />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/50">
            No location data available.
          </div>
        )}
      </div>
    </div>
  );
}
