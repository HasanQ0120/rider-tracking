"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { DUTY_LOCATION_MIN_INTERVAL_MS, MAX_ACCURACY_M } from "@/lib/config";

type Screen =
  | "loading"
  | "invalid"
  | "inactive"
  | "off_duty"
  | "checking_in"
  | "on_duty"
  | "permission_denied";

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { res, data: await res.json().catch(() => ({})) };
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 8000,
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tooFarMessage(
  distanceMeters?: number,
  radiusMeters?: number,
  pickupLocationName?: string | null
): string {
  const place = pickupLocationName || "the pickup location";
  if (distanceMeters != null && radiusMeters != null) {
    return `You must be at ${place} to go on duty. You're currently too far away — about ${distanceMeters}m, and you need to be within ${radiusMeters}m.`;
  }
  return `You must be at ${place} to go on duty. You're currently too far away.`;
}

// Bad first GPS fixes are common indoors/on a cold start -- worth a couple
// of quiet retries before giving up, rather than treating "inaccurate" the
// same as "too far away" on the very first attempt.
const CHECKIN_ACCURACY_RETRIES = 3;

export function DutyClient({ token }: { token: string }) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [riderName, setRiderName] = useState("");
  const [waitingForAccuracy, setWaitingForAccuracy] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initCalledRef = useRef(false);
  // Read from the recurring-ping tick and the check-in flow alike; a ref
  // (rather than plain state) avoids every callback below needing to be
  // re-created whenever it's set.
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ongoing pings once already on duty -- the server only geofence-checks
  // a ping when there's no fresh existing session, so these routine
  // refreshes aren't re-gated on every tick, only a fresh check-in is.
  const sendLocation = useCallback(
    (lat: number, lng: number, accuracy: number) => {
      if (!sessionIdRef.current) return;
      if (accuracy > MAX_ACCURACY_M) {
        setWaitingForAccuracy(true);
        return;
      }
      postJson(`/api/duty/${token}/location`, {
        lat,
        lng,
        accuracy_m: accuracy,
        session_id: sessionIdRef.current,
      }).then(({ data }) => {
        switch (data.status) {
          case "ok":
            setWaitingForAccuracy(false);
            setLastSentAt(new Date());
            break;
          case "inaccurate":
            setWaitingForAccuracy(true);
            break;
          case "too_far":
            // The session had gone stale and this refresh ping got treated
            // as a fresh check-in server-side, from somewhere outside the
            // radius -- drop back to off-duty rather than silently keep
            // ticking with nothing actually being recorded.
            if (intervalRef.current) clearInterval(intervalRef.current);
            setScreen("off_duty");
            setCheckInError(tooFarMessage(data.distanceMeters, data.radiusMeters, data.pickupLocationName));
            break;
          case "inactive":
            if (intervalRef.current) clearInterval(intervalRef.current);
            setScreen("inactive");
            break;
          case "invalid":
            if (intervalRef.current) clearInterval(intervalRef.current);
            setScreen("invalid");
            break;
          default:
            break;
        }
      });
    },
    [token]
  );

  const startPingLoop = useCallback(() => {
    const tick = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setScreen("permission_denied");
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
      );
    };
    intervalRef.current = setInterval(tick, DUTY_LOCATION_MIN_INTERVAL_MS + 2000);
  }, [sendLocation]);

  const init = useCallback(async () => {
    const { data } = await postJson(`/api/duty/${token}/init`, {});
    switch (data.status) {
      case "invalid":
        setScreen("invalid");
        break;
      case "inactive":
        setScreen("inactive");
        break;
      case "ok":
        setRiderName(data.riderName);
        sessionIdRef.current = data.sessionId;
        if (data.onDuty) {
          // A fresh rider_duty_locations row already exists (e.g. a mobile
          // browser reloaded a backgrounded tab) -- resume the on-duty view
          // and ping loop instead of blindly showing the check-in button
          // again over a session that's still actually active.
          setLastSentAt(data.recordedAt ? new Date(data.recordedAt) : null);
          setScreen("on_duty");
          startPingLoop();
        } else {
          setScreen("off_duty");
        }
        break;
      default:
        setScreen("invalid");
    }
  }, [token, startPingLoop]);

  // The check-in itself: the one attempt that's actually geofence-gated
  // server-side, deciding whether "on duty" is allowed to start at all.
  const goOnDuty = useCallback(async () => {
    setCheckInError(null);
    setScreen("checking_in");

    for (let attempt = 0; attempt < CHECKIN_ACCURACY_RETRIES; attempt++) {
      let pos: GeolocationPosition;
      try {
        pos = await getPosition();
      } catch (err) {
        const geoErr = err as GeolocationPositionError;
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setScreen("permission_denied");
        } else {
          setScreen("off_duty");
          setCheckInError("Couldn't get your location. Please try again.");
        }
        return;
      }

      if (pos.coords.accuracy > MAX_ACCURACY_M) {
        setWaitingForAccuracy(true);
        await sleep(2000);
        continue;
      }
      setWaitingForAccuracy(false);

      const { data } = await postJson(`/api/duty/${token}/location`, {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy_m: pos.coords.accuracy,
        session_id: sessionIdRef.current,
      });

      switch (data.status) {
        case "ok":
          setLastSentAt(new Date());
          setScreen("on_duty");
          startPingLoop();
          return;
        case "too_far":
          setScreen("off_duty");
          setCheckInError(tooFarMessage(data.distanceMeters, data.radiusMeters, data.pickupLocationName));
          return;
        case "inactive":
          setScreen("inactive");
          return;
        case "invalid":
          setScreen("invalid");
          return;
        default:
          setScreen("off_duty");
          setCheckInError("Couldn't check you in. Please try again.");
          return;
      }
    }

    setScreen("off_duty");
    setCheckInError(
      "We couldn't get an accurate location. Please move to an open area with a clear view of the sky and try again."
    );
  }, [token, startPingLoop]);

  const goOffDuty = useCallback(async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setScreen("off_duty");
    setLastSentAt(null);
    setWaitingForAccuracy(false);
    setCheckInError(null);
    await postJson(`/api/duty/${token}/offduty`, {});
  }, [token]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (screen === "loading") {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }
  if (screen === "invalid") {
    return <CenteredMessage>This link is invalid.</CenteredMessage>;
  }
  if (screen === "inactive") {
    return <CenteredMessage>Your rider account is currently inactive. Contact ops.</CenteredMessage>;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6 text-center">
      <Card className="animate-scale-in">
        <h1 className="text-lg font-semibold text-white">Hi, {riderName}</h1>
        <p className="mt-1 text-sm text-white/60">
          Go on duty to be considered for automatic order assignment while you&apos;re between
          deliveries.
        </p>

        {screen === "permission_denied" && (
          <div className="mt-4">
            <StatusBanner tone="danger">
              Location access has been turned off. Please enable it in your browser settings to go
              on duty.
            </StatusBanner>
          </div>
        )}

        {checkInError && screen === "off_duty" && (
          <div className="mt-4">
            <StatusBanner tone="danger">{checkInError}</StatusBanner>
          </div>
        )}

        {waitingForAccuracy && (screen === "on_duty" || screen === "checking_in") && (
          <div className="mt-4">
            <StatusBanner tone="warning">Waiting for an accurate GPS signal…</StatusBanner>
          </div>
        )}

        {screen === "on_duty" ? (
          <>
            <div className="mt-5 flex items-center justify-center gap-2 text-status-success">
              <span className="h-2 w-2 rounded-full bg-current" />
              <span className="text-sm font-medium">On duty</span>
            </div>
            {lastSentAt && (
              <p className="mt-1 text-xs text-white/40">
                Last location sent {lastSentAt.toLocaleTimeString()}
              </p>
            )}
            <Button className="mt-5 w-full" variant="accent-outline" onClick={goOffDuty}>
              Go Off Duty
            </Button>
          </>
        ) : (
          <Button className="mt-5 w-full" onClick={goOnDuty} disabled={screen === "checking_in"}>
            {screen === "checking_in" && <Spinner className="h-4 w-4" />}
            {screen === "checking_in" ? "Checking you in…" : "Go On Duty"}
          </Button>
        )}
      </Card>
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
