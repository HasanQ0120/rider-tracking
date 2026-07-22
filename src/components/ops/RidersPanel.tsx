"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { cleanPhoneInput, isValidPakistaniMobile, PK_MOBILE_HINT } from "@/lib/phone";
import { scrollToError } from "@/lib/scrollToError";

type Rider = {
  id: string;
  name: string;
  phone: string;
  license_plate: string | null;
  active: boolean;
  created_at: string;
  deliveredCount?: number;
  activeCount?: number;
};

export function RidersPanel({ initialRiders }: { initialRiders: Rider[] }) {
  const [riders, setRiders] = useState(initialRiders);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  function showPhoneError(message: string) {
    setPhoneError(message);
    requestAnimationFrame(() => scrollToError(phoneInputRef));
  }

  async function addRider() {
    if (!isValidPakistaniMobile(phone)) {
      showPhoneError(PK_MOBILE_HINT);
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/ops/riders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone: cleanPhoneInput(phone),
        license_plate: licensePlate.trim(),
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.rider) {
      setRiders([{ ...data.rider, deliveredCount: 0, activeCount: 0 }, ...riders]);
      setName("");
      setPhone("");
      setLicensePlate("");
      setShowAddForm(false);
    } else if (data.status === "invalid_phone") {
      showPhoneError(PK_MOBILE_HINT);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? "Cancel" : "+ Add Rider"}
        </Button>
      </div>

      {showAddForm && (
        <Card title="Add Rider" className="animate-slide-up">
          <div className="space-y-3">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <div>
              <Input
                ref={phoneInputRef}
                placeholder="Phone (e.g. 03XXXXXXXXX)"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (phoneError) setPhoneError(null);
                }}
                onBlur={() => {
                  if (phone.trim() && !isValidPakistaniMobile(phone)) {
                    setPhoneError(PK_MOBILE_HINT);
                  }
                }}
                className={phoneError ? "border-status-danger" : ""}
              />
              {phoneError && (
                <p className="mt-1 text-sm text-status-danger" role="alert">
                  {phoneError}
                </p>
              )}
            </div>
            <Input
              placeholder="License plate (e.g. ABC-123)"
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value)}
            />
            <Button onClick={addRider} disabled={submitting || !name || !phone || !licensePlate.trim()}>
              {submitting && <Spinner className="h-4 w-4" />}
              Add Rider
            </Button>
          </div>
        </Card>
      )}

      {riders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-white/50">
          No riders yet.
        </div>
      ) : (
        <div className="space-y-3">
          {riders.map((r) => (
            <div
              key={r.id}
              className="animate-fade-in flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-surface-raised p-4 transition-colors hover:bg-white/5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-brand-navy text-sm font-semibold text-white">
                  {r.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-white">{r.name}</p>
                  <p className="text-xs text-white/50">
                    {r.phone}
                    {r.license_plate && (
                      <span className="ml-2 font-mono text-brand-gold/80">{r.license_plate}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-right">
                <span className="text-xs text-white/40">{r.deliveredCount ?? 0} deliveries</span>
                {(r.activeCount ?? 0) > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {r.activeCount} active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-status-success/15 px-2.5 py-1 text-xs font-medium text-status-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    Available
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-white/40">{riders.length} riders registered</p>
    </div>
  );
}
