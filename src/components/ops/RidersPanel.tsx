"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Rider = { id: string; name: string; phone: string; active: boolean; created_at: string };

export function RidersPanel({ initialRiders }: { initialRiders: Rider[] }) {
  const [riders, setRiders] = useState(initialRiders);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function addRider() {
    setSubmitting(true);
    const res = await fetch("/api/ops/riders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.rider) {
      setRiders([data.rider, ...riders]);
      setName("");
      setPhone("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-brand-navy/10 p-4">
        <h2 className="mb-2 font-semibold text-brand-navy">Add Rider</h2>
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-2 w-full rounded-lg border border-brand-navy/30 px-3 py-2"
        />
        <input
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mb-2 w-full rounded-lg border border-brand-navy/30 px-3 py-2"
        />
        <Button onClick={addRider} disabled={submitting || !name || !phone}>
          Add Rider
        </Button>
      </div>

      <div className="rounded-lg border border-brand-navy/10">
        {riders.map((r) => (
          <div key={r.id} className="flex justify-between border-b border-brand-navy/10 px-4 py-2 last:border-b-0">
            <span>{r.name}</span>
            <span className="text-brand-navy/60">{r.phone}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
