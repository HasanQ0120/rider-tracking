"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { TrackingMap, type MapMarker } from "@/components/map/TrackingMap";
import { createBrowserClient } from "@/lib/supabase/browser";
import { haversineMeters } from "@/lib/geo";
import {
  CONNECTION_LOST_TIMEOUT_S,
  PROXIMITY_RADIUS_M,
  MARKER_COLOR_CUSTOMER,
  MARKER_COLOR_RIDER,
} from "@/lib/config";

type OrderInfo = {
  id: string;
  status: string;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  rider_arrived_at: string | null;
  tracking_expired_unresolved: boolean;
};
type Rider = { name: string; phone: string } | null;
type Loc = { lat: number; lng: number; accuracy_m: number; recorded_at: string };

const JWT_REFRESH_MS = 10 * 60 * 1000;

export function CustomerTrackingClient({ token }: { token: string }) {
  const [screen, setScreen] = useState<"loading" | "invalid" | "live">("loading");
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [rider, setRider] = useState<Rider>(null);
  const [loc, setLoc] = useState<Loc | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const [completing, setCompleting] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef(createBrowserClient());
  const staleCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshAuth = useCallback(async () => {
    const res = await fetch(`/api/customer/${token}/init`, { method: "POST" });
    const data = await res.json();
    if (data.status !== "ok") {
      setScreen("invalid");
      return null;
    }
    setOrder(data.order);
    setRider(data.rider);
    setScreen("live");
    await supabaseRef.current.realtime.setAuth(data.jwt);
    return data.order.id as string;
  }, [token]);

  useEffect(() => {
    let jwtTimer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const orderId = await refreshAuth();
      if (!orderId) return;

      const supabase = supabaseRef.current;

      const { data: initial } = await supabase
        .from("current_locations")
        .select("lat, lng, accuracy_m, recorded_at")
        .eq("order_id", orderId)
        .maybeSingle();
      if (initial) setLoc(initial);

      const channel = supabase
        .channel(`order-${orderId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "current_locations", filter: `order_id=eq.${orderId}` },
          (payload) => setLoc(payload.new as Loc)
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
          (payload) => setOrder(payload.new as OrderInfo)
        )
        .subscribe();
      channelRef.current = channel;

      // Re-validates the customer token against the DB on every refresh --
      // access is enforced per-connection, not just once at first load.
      jwtTimer = setInterval(refreshAuth, JWT_REFRESH_MS);
    })();

    return () => {
      channelRef.current?.unsubscribe();
      if (jwtTimer) clearInterval(jwtTimer);
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

  const canComplete =
    order?.status !== "delivered" &&
    order?.status !== "cancelled" &&
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
      <div className="mx-auto max-w-md p-6 text-center">
        <StatusBanner tone="success">Your order has been delivered!</StatusBanner>
      </div>
    );
  }
  // Distinguished from the generic "connection lost" state: this means the
  // rider's own link expired and a fresh one is being (re)issued, not that
  // the order was ever marked delivered.
  if (order.tracking_expired_unresolved) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <StatusBanner tone="warning">
          Tracking link expired. We&apos;re re-establishing the connection with your rider — this
          page will resume automatically.
        </StatusBanner>
        {rider && <CallButton phone={rider.phone} />}
      </div>
    );
  }

  const markers: MapMarker[] = [];
  if (order.delivery_lat != null && order.delivery_lng != null) {
    markers.push({ id: "delivery", lat: order.delivery_lat, lng: order.delivery_lng, color: MARKER_COLOR_CUSTOMER });
  }
  if (loc) {
    markers.push({ id: "rider", lat: loc.lat, lng: loc.lng, color: MARKER_COLOR_RIDER });
  }
  const defaultCenter: [number, number] = order.delivery_lng
    ? [order.delivery_lat!, order.delivery_lng]
    : loc
      ? [loc.lat, loc.lng]
      : [0, 0];

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-brand-navy/10 bg-white p-3">
        {connectionLost && (
          <StatusBanner tone="danger">
            Connection lost — showing rider&apos;s last known position.
          </StatusBanner>
        )}
      </div>
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
        />
      </div>
      <div className="flex items-center gap-3 border-t border-brand-navy/10 bg-white p-4">
        {rider && <CallButton phone={rider.phone} />}
        {canComplete && (
          <Button onClick={tapComplete} disabled={completing} className="flex-1">
            Complete
          </Button>
        )}
      </div>
    </div>
  );
}

function CallButton({ phone }: { phone: string }) {
  return (
    <a href={`tel:${phone}`}>
      <Button variant="accent">Call Rider</Button>
    </a>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen items-center justify-center p-6 text-center text-brand-navy">
      {children}
    </div>
  );
}
