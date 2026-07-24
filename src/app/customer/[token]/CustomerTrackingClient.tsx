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
  assigned_rider_id?: string | null;
  // 0 (or absent) means this is the rider's current delivery -- show the
  // normal live map. N>0 means N of the rider's other active orders were
  // assigned before this one; show the queued message instead, never the
  // map/ETA. Recomputed server-side on every poll, so this naturally
  // ticks down (and eventually reaches 0) as those earlier orders resolve.
  orders_ahead?: number;
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

  // True whenever this order isn't yet the rider's current delivery -- see
  // src/lib/orderQueue.ts. Gates the rider marker/route/ETA/courier-card
  // out of the shared live-tracking render below rather than a separate
  // early-return, so this order falls through to the exact same live view
  // as any other the instant orders_ahead reaches 0 (no new mechanism).
  const isQueued = Boolean(order?.orders_ahead && order.orders_ahead > 0);

  // The rider-initiated confirmation flow (pending_confirmation/
  // flagged_review) replaces this generic button for those two states --
  // it's still available independently otherwise, e.g. if the customer
  // wants to confirm before the rider has tapped anything.
  const canComplete =
    !isQueued &&
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
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <Card className="w-full max-w-sm animate-scale-in text-center">
          <StatusBanner tone="success">Your order has been delivered!</StatusBanner>
        </Card>
      </div>
    );
  }
  if (order.status === "flagged_review") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
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
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <Card className="w-full max-w-sm animate-scale-in space-y-4 text-center">
          <p className="text-white">
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
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
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
  if (!isQueued && loc) {
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

  const distanceKm =
    !isQueued && loc && order.delivery_lat != null && order.delivery_lng != null
      ? haversineMeters(loc.lat, loc.lng, order.delivery_lat, order.delivery_lng) / 1000
      : null;
  const etaMinutes = etaSeconds != null ? Math.max(1, Math.round(etaSeconds / 60)) : null;
  const isRiderAssigned = Boolean(order.assigned_rider_id);
  // A rider is assigned but hasn't sent a location yet (link not opened,
  // permission not granted, or no GPS fix yet) -- a bare map with nothing
  // but the destination pin reads as broken, not "in progress." Resolves
  // itself automatically the instant a real `loc` comes back from the same
  // poll() -> setLoc path that already drives every other live transition
  // on this page, no separate polling needed. Deliberately scoped to "rider
  // assigned" only -- before that, the existing "Rider not yet assigned"
  // bottom banner already covers it, so the map there is left as-is. The
  // queue message always wins over this for a queued order.
  const waitingForLocation = !isQueued && Boolean(rider) && !loc;
  const queueMessage = (() => {
    const n = order.orders_ahead ?? 0;
    return `Your rider has picked up your order. He's currently completing ${n} other ${
      n === 1 ? "delivery" : "deliveries"
    } first — you're next after that.`;
  })();

  return (
    <div className="relative h-screen overflow-hidden bg-surface">
      <div className="absolute inset-0">
        {waitingForLocation ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-surface px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-white/30">
              <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="currentColor" strokeWidth={1.6}>
                <path d="M9 4l-5 2v14l5-2 6 2 5-2V4l-5 2-6-2z" />
                <path d="M9 4v14M15 6v14" />
              </svg>
            </div>
            <p className="max-w-xs text-sm text-white/50">
              Waiting for your rider to start sharing their location.
            </p>
          </div>
        ) : (
          <TrackingMap
            markers={markers}
            defaultCenter={defaultCenter}
            routeFrom={isQueued ? null : loc}
            routeTo={
              !isQueued && order.delivery_lat != null && order.delivery_lng != null
                ? { lat: order.delivery_lat, lng: order.delivery_lng }
                : null
            }
            onRouteInfo={(info) => setEtaSeconds(info?.durationSeconds ?? null)}
          />
        )}
      </div>

      {/* z-[2000] matches ConfirmDialog's -- Leaflet's own panes/controls
          carry z-index up to 1000 and escape into the root stacking
          context, so anything meant to float above the map needs to clear
          that, not just Tailwind's default scale. */}
      <div className="absolute inset-x-0 top-0 z-[2000] animate-slide-up border-b border-white/10 bg-surface-raised/95 px-4 py-3 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-4">
          {etaMinutes != null && (
            <div className="shrink-0 text-center">
              <p className="text-lg font-bold text-brand-gold">{etaMinutes} min</p>
              {distanceKm != null && (
                <p className="text-xs text-white/50">{distanceKm.toFixed(1)} km away</p>
              )}
            </div>
          )}
          <div className={`min-w-0 flex-1 ${etaMinutes != null ? "border-l border-white/10 pl-4" : ""}`}>
            <p className="flex items-center gap-1.5 text-sm font-medium text-brand-gold">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" />
              {isQueued ? queueMessage : isRiderAssigned ? "Your rider is on the way" : "Preparing your order"}
            </p>
            {order.delivery_address && (
              <p className="truncate text-xs text-white/50">
                {order.delivery_address}
                {order.address_detail ? `, ${order.address_detail}` : ""}
              </p>
            )}
            {loc?.speed_kmh != null && (
              <p className="text-xs text-white/40">{formatRiderSpeed(loc.speed_kmh)}</p>
            )}
          </div>
        </div>
      </div>

      {connectionLost && (
        <div className="absolute inset-x-0 top-16 z-[2000] px-4">
          <StatusBanner tone="danger">
            Connection lost — showing rider&apos;s last known position.
          </StatusBanner>
        </div>
      )}

      {/* Hidden entirely while queued -- no courier card, no Call button,
          no Complete button. The rider is real and assigned, but showing
          their identity/a working call button here reads as "available to
          you right now," which isn't true while they're still finishing
          other deliveries first. */}
      {!isQueued && (
        <div className="absolute inset-x-0 bottom-0 z-[2000] animate-slide-up border-t border-white/10 bg-surface-raised/95 p-4 shadow-lg backdrop-blur-sm">
          {rider ? (
            <>
              <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/50">Your courier</p>
                  <p className="text-base font-semibold text-white">{rider.name}</p>
                </div>
                {rider.license_plate && (
                  <p className="rounded-md bg-brand-gold px-2 py-1 text-xs font-semibold tracking-wide text-brand-navy">
                    {rider.license_plate}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="animate-fade-in">
                  <CallButton phone={rider.phone} label="Call Rider" />
                </div>
                {canComplete && (
                  <Button onClick={tapComplete} disabled={completing} className="flex-1 animate-fade-in">
                    {completing && <Spinner className="h-4 w-4" />}
                    Complete
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/40">
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Rider not yet assigned</p>
                <p className="text-xs text-white/50">Your order is being prepared</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen items-center justify-center bg-surface p-6">
      <div className="animate-scale-in max-w-sm rounded-xl border border-white/10 bg-surface-raised p-6 text-center text-white shadow-sm">
        {children}
      </div>
    </div>
  );
}
