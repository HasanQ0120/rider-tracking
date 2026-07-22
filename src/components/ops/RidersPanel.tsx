"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { cleanPhoneInput, isValidPakistaniMobile, PK_MOBILE_HINT } from "@/lib/phone";

type Rider = { id: string; name: string; phone: string; active: boolean; created_at: string };

export function RidersPanel({ initialRiders }: { initialRiders: Rider[] }) {
  const [riders, setRiders] = useState(initialRiders);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function addRider() {
    if (!isValidPakistaniMobile(phone)) {
      setPhoneError(PK_MOBILE_HINT);
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/ops/riders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone: cleanPhoneInput(phone) }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.rider) {
      setRiders([data.rider, ...riders]);
      setName("");
      setPhone("");
    } else if (data.status === "invalid_phone") {
      setPhoneError(PK_MOBILE_HINT);
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Add Rider">
        <div className="space-y-3">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <Input
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
          <Button onClick={addRider} disabled={submitting || !name || !phone}>
            {submitting && <Spinner className="h-4 w-4" />}
            Add Rider
          </Button>
        </div>
      </Card>

      {riders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-navy/20 p-8 text-center text-brand-navy/50">
          No riders yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-brand-navy/10 shadow-sm">
          {riders.map((r) => (
            <div
              key={r.id}
              className="animate-fade-in flex justify-between border-b border-brand-navy/10 px-4 py-3 transition-colors last:border-b-0 hover:bg-brand-navy/5"
            >
              <span className="font-medium text-brand-navy">{r.name}</span>
              <span className="text-brand-navy/60">{r.phone}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
