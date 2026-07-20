"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { TrackingMap, type MapMarker } from "@/components/map/TrackingMap";
import { getOrCreateDeviceKey } from "@/lib/deviceKey";
import { LOCATION_MIN_INTERVAL_MS, MAX_ACCURACY_M } from "@/lib/config";

type Screen =
  | "loading"
  | "invalid"
  | "closed"
  | "locked_out"
  | "blocked_device"
  | "pin"
  | "ready"
  | "tracking"
  | "permission_denied"
  | "session_moved"
  | "completed";

type OrderInfo = {
  id: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_address: string;
};

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { res, data: await res.json().catch(() => ({})) };
}

export function RiderTrackingClient({ token }: { token: string }) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [waitingForAccuracy, setWaitingForAccuracy] = useState(false);
  const [arrivedTapped, setArrivedTapped] = useState(false);
  const [ownPosition, setOwnPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "limited">("idle");

  const deviceKeyRef = useRef<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    deviceKeyRef.current = getOrCreateDeviceKey(token);
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const init = useCallback(async () => {
    const { data } = await postJson(`/api/rider/${token}/init`, {
      device_key: deviceKeyRef.current,
    });
    if (data.order) setOrder(data.order);

    switch (data.status) {
      case "invalid":
        setScreen("invalid");
        break;
      case "closed":
        setScreen("completed");
        break;
      case "locked_out":
        setLockedUntil(data.lockedUntil ?? null);
        setScreen("locked_out");
        break;
      case "blocked_device":
        setScreen("blocked_device");
        break;
      case "need_pin":
        setScreen("pin");
        break;
      case "active":
        setSessionId(data.sessionId);
        setScreen("ready");
        break;
      default:
        setScreen("invalid");
    }
  }, [token]);

  const submitPin = useCallback(async () => {
    setPinError(null);
    const { res, data } = await postJson(`/api/rider/${token}/verify-pin`, {
      pin,
      device_key: deviceKeyRef.current,
    });
    if (data.status === "active") {
      setSessionId(data.sessionId);
      setScreen("ready");
    } else if (data.status === "locked_out") {
      setScreen("locked_out");
    } else if (data.status === "blocked_device") {
      setScreen("blocked_device");
    } else if (res.status === 401) {
      setPinError(
        data.attemptsRemaining != null
          ? `Incorrect PIN. ${data.attemptsRemaining} attempt(s) remaining.`
          : "Incorrect PIN."
      );
    } else {
      setPinError("Something went wrong. Please try again.");
    }
  }, [token, pin]);

  const sendLocation = useCallback(
    (lat: number, lng: number, accuracy: number) => {
      if (!sessionId) return;
      if (accuracy > MAX_ACCURACY_M) {
        setWaitingForAccuracy(true);
        return;
      }
      postJson(`/api/rider/${token}/location`, {
        lat,
        lng,
        accuracy_m: accuracy,
        session_id: sessionId,
        device_key: deviceKeyRef.current,
      }).then(({ data }) => {
        switch (data.status) {
          case "ok":
            setWaitingForAccuracy(false);
            setOwnPosition({ lat, lng });
            break;
          case "inaccurate":
            setWaitingForAccuracy(true);
            break;
          case "session_superseded":
            if (intervalRef.current) clearInterval(intervalRef.current);
            setScreen("session_moved");
            break;
          case "blocked_device":
            if (intervalRef.current) clearInterval(intervalRef.current);
            setScreen("blocked_device");
            break;
          case "closed":
            if (intervalRef.current) clearInterval(intervalRef.current);
            setScreen("completed");
            break;
          default:
            break;
        }
      });
    },
    [token, sessionId]
  );

  const startTracking = useCallback(() => {
    setScreen("tracking");
    const tick = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setScreen("permission_denied");
          }
          // Other errors (timeout / position unavailable): retry quietly on
          // the next tick, no user-facing alarm for a transient GPS blip.
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
      );
    };
    tick();
    intervalRef.current = setInterval(tick, LOCATION_MIN_INTERVAL_MS + 2000);
  }, [sendLocation]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const tapArrived = useCallback(async () => {
    await postJson(`/api/rider/${token}/arrived`, { device_key: deviceKeyRef.current });
    setArrivedTapped(true);
  }, [token]);

  const tapDelivered = useCallback(async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    await postJson(`/api/rider/${token}/complete`, { device_key: deviceKeyRef.current });
    setScreen("completed");
  }, [token]);

  const requestResend = useCallback(async () => {
    setResendState("sending");
    const { res } = await postJson(`/api/rider/${token}/resend`, {});
    setResendState(res.status === 429 ? "limited" : "sent");
  }, [token]);

  if (screen === "loading") {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }
  if (screen === "invalid") {
    return <CenteredMessage>This tracking link is invalid or has expired.</CenteredMessage>;
  }
  if (screen === "completed") {
    return <CenteredMessage>This delivery has been completed. Thank you!</CenteredMessage>;
  }
  if (screen === "locked_out") {
    return (
      <CenteredMessage>
        Too many incorrect PIN attempts. Please try again{" "}
        {lockedUntil ? `after ${new Date(lockedUntil).toLocaleTimeString()}` : "in 15 minutes"}.
      </CenteredMessage>
    );
  }
  if (screen === "blocked_device") {
    return (
      <CenteredMessage>
        This tracking link is already active on another device. If you need to switch devices
        (e.g. your phone died), contact ops to reset this delivery&apos;s tracking session.
      </CenteredMessage>
    );
  }
  if (screen === "session_moved") {
    return <CenteredMessage>Tracking has moved to another tab or window.</CenteredMessage>;
  }
  if (screen === "permission_denied") {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <StatusBanner tone="danger">
          Location access has been turned off. Please enable it in your browser settings to
          continue sharing your location.
        </StatusBanner>
        <div className="mt-4">
          <Button onClick={startTracking}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (screen === "pin") {
    return (
      <div className="mx-auto max-w-md p-6">
        <ConsentLine />
        <h1 className="mt-4 text-lg font-semibold text-brand-navy">Enter your PIN</h1>
        <p className="mt-1 text-sm text-brand-navy/70">
          We sent a 6-digit PIN to your phone in a separate message.
        </p>
        <input
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="mt-4 w-full rounded-lg border border-brand-navy/30 px-4 py-3 text-center text-2xl tracking-widest"
          placeholder="••••••"
        />
        {pinError && (
          <p className="mt-2 text-sm text-status-danger" role="alert">
            {pinError}
          </p>
        )}
        <Button
          className="mt-4 w-full"
          disabled={pin.length !== 6}
          onClick={submitPin}
        >
          Confirm PIN
        </Button>
      </div>
    );
  }

  if (screen === "ready") {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <ConsentLine />
        <Button className="mt-6" onClick={startTracking}>
          Start Sharing My Location
        </Button>
      </div>
    );
  }

  // screen === "tracking"
  const markers: MapMarker[] = [];
  if (order?.delivery_lat != null && order?.delivery_lng != null) {
    markers.push({
      id: "delivery",
      lat: order.delivery_lat,
      lng: order.delivery_lng,
      color: "#0A192F",
      label: "Delivery address",
    });
  }
  if (ownPosition) {
    markers.push({ id: "self", lat: ownPosition.lat, lng: ownPosition.lng, color: "#FFD700" });
  }
  const defaultCenter: [number, number] = order?.delivery_lng
    ? [order.delivery_lng, order.delivery_lat!]
    : [0, 0];

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-brand-navy/10 bg-white p-3">
        {waitingForAccuracy && (
          <StatusBanner tone="warning">Waiting for an accurate GPS signal…</StatusBanner>
        )}
      </div>
      <div className="flex-1">
        <TrackingMap markers={markers} defaultCenter={defaultCenter} />
      </div>
      <div className="flex flex-col gap-2 border-t border-brand-navy/10 bg-white p-4">
        {!arrivedTapped && <Button onClick={tapArrived}>I&apos;ve Arrived</Button>}
        <Button onClick={tapDelivered}>Mark as Delivered</Button>
        <button
          onClick={requestResend}
          disabled={resendState === "sending" || resendState === "limited"}
          className="text-sm text-brand-navy/60 underline disabled:opacity-50"
        >
          {resendState === "sent"
            ? "Link resent"
            : resendState === "limited"
              ? "Please wait before requesting again"
              : "Resend my tracking link"}
        </button>
      </div>
    </div>
  );
}

function ConsentLine() {
  return (
    <StatusBanner tone="warning">
      Your location will be shared with the customer until delivery is marked complete.
    </StatusBanner>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen items-center justify-center p-6 text-center text-brand-navy">
      {children}
    </div>
  );
}
