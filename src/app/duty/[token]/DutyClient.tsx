"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { Card } from "@/components/ui/Card";
import { DUTY_LOCATION_MIN_INTERVAL_MS, MAX_ACCURACY_M } from "@/lib/config";

type Screen = "loading" | "invalid" | "inactive" | "off_duty" | "on_duty" | "permission_denied";

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { res, data: await res.json().catch(() => ({})) };
}

export function DutyClient({ token }: { token: string }) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [riderName, setRiderName] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [waitingForAccuracy, setWaitingForAccuracy] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initCalledRef = useRef(false);

  useEffect(() => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        setSessionId(data.sessionId);
        setScreen("off_duty");
        break;
      default:
        setScreen("invalid");
    }
  }, [token]);

  const sendLocation = useCallback(
    (lat: number, lng: number, accuracy: number) => {
      if (!sessionId) return;
      if (accuracy > MAX_ACCURACY_M) {
        setWaitingForAccuracy(true);
        return;
      }
      postJson(`/api/duty/${token}/location`, {
        lat,
        lng,
        accuracy_m: accuracy,
        session_id: sessionId,
      }).then(({ data }) => {
        switch (data.status) {
          case "ok":
            setWaitingForAccuracy(false);
            setLastSentAt(new Date());
            break;
          case "inaccurate":
            setWaitingForAccuracy(true);
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
    [token, sessionId]
  );

  const goOnDuty = useCallback(() => {
    setScreen("on_duty");
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
    tick();
    intervalRef.current = setInterval(tick, DUTY_LOCATION_MIN_INTERVAL_MS + 2000);
  }, [sendLocation]);

  const goOffDuty = useCallback(async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setScreen("off_duty");
    setLastSentAt(null);
    setWaitingForAccuracy(false);
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

        {waitingForAccuracy && screen === "on_duty" && (
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
          <Button className="mt-5 w-full" onClick={goOnDuty}>
            Go On Duty
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
