"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBanner } from "@/components/ui/StatusBanner";

type Screen = "loading" | "invalid" | "ready";

export function AvailabilityClient({ token }: { token: string }) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [name, setName] = useState("");
  const [available, setAvailable] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/rider/availability/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== "ok") {
          setScreen("invalid");
          return;
        }
        setName(data.name);
        setAvailable(data.available);
        setScreen("ready");
      })
      .catch(() => setScreen("invalid"));
  }, [token]);

  async function toggle() {
    const next = !available;
    setSaving(true);
    try {
      const res = await fetch(`/api/rider/availability/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: next }),
      });
      const data = await res.json().catch(() => null);
      if (data?.status === "ok") setAvailable(data.available);
    } finally {
      setSaving(false);
    }
  }

  if (screen === "loading") {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6">
        <Spinner className="h-8 w-8 text-white/50" />
      </div>
    );
  }

  if (screen === "invalid") {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
        <StatusBanner tone="danger">This link isn&apos;t valid.</StatusBanner>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6 text-center">
      <Card className="animate-slide-up">
        <h1 className="text-lg font-semibold text-white">Hi {name}</h1>
        <p className="mt-2 text-sm text-white/60">
          {available
            ? "You're marked available — new deliveries can be assigned to you."
            : "You're marked not available — you won't be assigned any new deliveries."}
        </p>
        <Button
          className="mt-6 w-full"
          variant={available ? "accent-outline" : "primary"}
          disabled={saving}
          onClick={toggle}
        >
          {saving ? <Spinner /> : available ? "Go Unavailable" : "Available for Deliveries"}
        </Button>
      </Card>
    </div>
  );
}
