"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { CallButton } from "@/components/ui/CallButton";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { TrackingMap, type MapMarker } from "@/components/map/TrackingMap";
import { haversineMeters } from "@/lib/geo";
import { formatEta, formatRiderSpeed } from "@/lib/format";
import {
  CONNECTION_LOST_TIMEOUT_S,
  PROXIMITY_RADIUS_M,
  CUSTOMER_POLL_INTERVAL_MS,
  MARKER_COLOR_CUSTOMER,
  MARKER_COLOR_RIDER,
} from "@/lib/config";

type OrderInfo = {
  id: string;
  status: string;
  delivery_address: string;
  address_detail?: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  rider_arrived_at: string | null;
  tracking_expired_unresolved: boolean;
  delivery_confirmed_by?: string | null;
  review_flag_reason?: string | null;
};
type Rider = { name: string; phone: string; license_plate: string | null } | null;
type Loc = {
  lat: number;
  lng: number;
  accuracy_m: number;
  heading: number | null;
  speed_kmh: number | null;
  recorded_at: string;
};

export function CustomerTrackingClient({ token }: { token: string }) {
  const [screen, setScreen] = useState<"loading" | "invalid" | "live">("loading");
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [rider, setRider] = useState<Rider>(null);
  const [loc, setLoc] = useState<Loc | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const [completing, setCompleting] = useState(false);
  // Tracks which response is in flight, not just whether one is -- so only
  // the button actually tapped shows its own spinner.
  const [confirmingResponse, setConfirmingResponse] = useState<"yes" | "no" | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const staleCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    // no-store: the browser itself can also cache a repeated GET to the
    // same URL, on top of the server-side caching fixed in the route.
    const res = await fetch(`/api/customer/${token}/poll`, { cache: "no-store" });
    if (res.status !== 200) return;
    const data = await res.json();
    if (data.status !== "ok") return;
    if (data.order) setOrder((prev) => (prev ? { ...prev, ...data.order } : prev));
    if (data.loc) setLoc(data.loc);
  }, [token]);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/customer/${token}/init`, { method: "POST" });
      const data = await res.json();
      if (data.status !== "ok") {
        setScreen("invalid");
        return;
      }
      setOrder(data.order);
      setRider(data.rider);
      setScreen("live");
      await poll();
    })();

    // Plain polling through our own service-role-backed API rather than a
    // direct Supabase Realtime subscription -- see /api/customer/[token]/poll
    // for why (a custom-signed JWT from the browser was silently rejected
    // by Realtime, so the rider marker never appeared here even though the
    // rider's own page worked fine).
    pollTimerRef.current = setInterval(poll, CUSTOMER_POLL_INTERVAL_MS);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (staleCheckRef.current) clearInterval(staleCheckRef.current);
    staleCheckRef.current = setInterval(() => {
      if (!loc) return;
      const ageS = (Date.now() - new Date(loc.recorded_at).getTime()) / 1000;
      setConnectionLost(ageS > CONNECTION_LOST_TIMEOUT_S);
    }, 5000);
    return () => {
      if (staleCheckRef.current) clearInterval(staleCheckRef.current);
    };
  }, [loc]);

  // The rider-initiated confirmation flow (pending_confirmation/
  // flagged_review) replaces this generic button for those two states --
  // it's still available independently otherwise, e.g. if the customer
  // wants to confirm before the rider has tapped anything.
  const canComplete =
    order?.status !== "delivered" &&
    order?.status !== "cancelled" &&
    order?.status !== "pending_confirmation" &&
    order?.status !== "flagged_review" &&
    (Boolean(order?.rider_arrived_at) ||
      (loc &&
        order?.delivery_lat != null &&
        order?.delivery_lng != null &&
        haversineMeters(order.delivery_lat, order.delivery_lng, loc.lat, loc.lng) <=
          PROXIMITY_RADIUS_M));

  const tapComplete = useCallback(async () => {
    setCompleting(true);
    const res = await fetch(`/api/customer/${token}/complete`, { method: "POST" });
    const data = await res.json();
    setCompleting(false);
    if (data.status === "ok" && order) {
      setOrder({ ...order, status: "delivered" });
    }
  }, [token, order]);

  const respondToConfirmation = useCallback(
    async (response: "yes" | "no") => {
      if (confirmingResponse) return;
      setConfirmingResponse(response);
      try {
        const res = await fetch(`/api/customer/${token}/confirm-delivery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response }),
        });
        const data = await res.json();
        if (data.resolvedStatus && order) {
          setOrder({ ...order, status: data.resolvedStatus });
        }
      } finally {
        setConfirmingResponse(null);
      }
    },
    [token, order, confirmingResponse]
  );

  if (screen === "loading") return <CenteredMessage>Loading…</CenteredMessage>;
  if (screen === "invalid") {
    return <CenteredMessage>This tracking link is invalid.</CenteredMessage>;
  }
  if (!order) return <CenteredMessage>Loading…</CenteredMessage>;

  if (order.status === "cancelled") {
    return <CenteredMessage>This order has been cancelled.</CenteredMessage>;
  }
  if (order.status === "delivered") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-navy/5 p-6">
        <Card className="w-full max-w-sm animate-scale-in text-center">
          <StatusBanner tone="success">Your order has been delivered!</StatusBanner>
        </Card>
      </div>
    );
  }
  if (order.status === "flagged_review") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-navy/5 p-6">
        <Card className="w-full max-w-sm animate-scale-in space-y-3 text-center">
          <StatusBanner tone="warning">
            We&apos;re looking into this and will follow up shortly.
          </StatusBanner>
          {rider && <CallButton phone={rider.phone} label="Call Rider" />}
        </Card>
      </div>
    );
  }
  if (order.status === "pending_confirmation") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-navy/5 p-6">
        <Card className="w-full max-w-sm animate-scale-in space-y-4 text-center">
          <p className="text-brand-navy">
            Your rider has marked this as delivered — did you receive your order?
          </p>
          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={() => respondToConfirmation("yes")}
              disabled={confirmingResponse !== null}
            >
              {confirmingResponse === "yes" && <Spinner className="h-4 w-4" />}
              {confirmingResponse === "yes" ? "Confirming…" : "Yes"}
            </Button>
            <Button
              variant="accent-outline"
              className="flex-1"
              onClick={() => respondToConfirmation("no")}
              disabled={confirmingResponse !== null}
            >
              {confirmingResponse === "no" && <Spinner className="h-4 w-4" />}
              {confirmingResponse === "no" ? "Submitting…" : "No"}
            </Button>
          </div>
          {rider && <CallButton phone={rider.phone} label="Call Rider" />}
        </Card>
      </div>
    );
  }
  // Distinguished from the generic "connection lost" state: this means the
  // rider's own link expired and a fresh one is being (re)issued, not that
  // the order was ever marked delivered.
  if (order.tracking_expired_unresolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-navy/5 p-6">
        <Card className="w-full max-w-sm animate-scale-in space-y-3 text-center">
          <StatusBanner tone="warning">
            Tracking link expired. We&apos;re re-establishing the connection with your rider — this
            page will resume automatically.
          </StatusBanner>
          {rider && <CallButton phone={rider.phone} label="Call Rider" />}
        </Card>
      </div>
    );
  }

  const markers: MapMarker[] = [];
  if (order.delivery_lat != null && order.delivery_lng != null) {
    markers.push({ id: "delivery", lat: order.delivery_lat, lng: order.delivery_lng, color: MARKER_COLOR_CUSTOMER });
  }
  if (loc) {
    markers.push({
      id: "rider",
      lat: loc.lat,
      lng: loc.lng,
      color: MARKER_COLOR_RIDER,
      shape: "arrow",
      heading: loc.heading,
    });
  }
  const defaultCenter: [number, number] = order.delivery_lng
    ? [order.delivery_lat!, order.delivery_lng]
    : loc
      ? [loc.lat, loc.lng]
      : [0, 0];

  return (
    <div className="flex h-screen flex-col">
      {order.delivery_address && (
        <div className="border-b border-brand-navy/10 bg-white px-4 py-2">
          <p className="text-sm font-medium text-brand-navy">{order.delivery_address}</p>
          {order.address_detail && (
            <p className="text-sm text-brand-navy/70">{order.address_detail}</p>
          )}
          {(etaSeconds != null || loc?.speed_kmh != null) && (
            <p className="text-sm text-brand-navy/70">
              {etaSeconds != null && formatEta(etaSeconds)}
              {etaSeconds != null && loc?.speed_kmh != null && " · "}
              {loc?.speed_kmh != null && formatRiderSpeed(loc.speed_kmh)}
            </p>
          )}
        </div>
      )}
      {connectionLost && (
        <div className="border-b border-brand-navy/10 bg-white p-3">
          <StatusBanner tone="danger">
            Connection lost — showing rider&apos;s last known position.
          </StatusBanner>
        </div>
      )}
      <div className="flex-1">
        <TrackingMap
          markers={markers}
          defaultCenter={defaultCenter}
          routeFrom={loc}
          routeTo={
            order.delivery_lat != null && order.delivery_lng != null
              ? { lat: order.delivery_lat, lng: order.delivery_lng }
              : null
          }
          onRouteInfo={(info) => setEtaSeconds(info?.durationSeconds ?? null)}
        />
      </div>
      <div className="border-t border-brand-navy/10 bg-white p-4 shadow-[0_-2px_8px_rgba(10,25,47,0.05)]">
        {rider && (
          // Mobile: sits in the normal flow, above the call/complete row, at
          // the bottom of the screen -- the inDrive-style "driver card"
          // spot. Desktop (md+): pulled out of that flow and floated over
          // the map instead, near the top-left; a placeholder position,
          // fine to move once this is visible on an actual desktop screen.
          // z-[2000] matches ConfirmDialog's -- Leaflet's own panes/controls
          // carry z-index up to 1000 and escape into the root stacking
          // context, so anything meant to sit above the map needs to clear
          // that, not just Tailwind's default scale.
          <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-brand-navy/10 bg-brand-navy/5 p-3 animate-slide-up md:fixed md:left-4 md:top-20 md:z-[2000] md:mb-0 md:w-64 md:border-brand-navy/10 md:bg-white md:shadow-lg">
            <div>
              <p className="text-xs uppercase tracking-wide text-brand-navy/50">Your courier</p>
              <p className="text-base font-semibold text-brand-navy">{rider.name}</p>
            </div>
            {rider.license_plate && (
              <p className="rounded-md bg-brand-navy px-2 py-1 text-xs font-semibold tracking-wide text-white">
                {rider.license_plate}
              </p>
            )}
          </div>
        )}
        <div className="flex items-center gap-3">
          {rider && (
            <div className="animate-fade-in">
              <CallButton phone={rider.phone} label="Call Rider" />
            </div>
          )}
          {canComplete && (
            <Button onClick={tapComplete} disabled={completing} className="flex-1 animate-fade-in">
              {completing && <Spinner className="h-4 w-4" />}
              Complete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen items-center justify-center bg-brand-navy/5 p-6">
      <div className="animate-scale-in max-w-sm rounded-xl border border-brand-navy/10 bg-white p-6 text-center text-brand-navy shadow-sm">
        {children}
      </div>
    </div>
  );
}
