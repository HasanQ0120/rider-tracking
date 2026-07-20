"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { TrackingMap } from "@/components/map/TrackingMap";

type GeocodeResult = { placeName: string; lat: number; lng: number };

export function NewOrderForm() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [candidates, setCandidates] = useState<GeocodeResult[]>([]);
  const [selected, setSelected] = useState<GeocodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function searchAddress() {
    setError(null);
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setError("Mapbox token is not configured.");
      return;
    }
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=5`
    );
    const data = await res.json();
    const results: GeocodeResult[] = (data.features ?? []).map(
      (f: { place_name: string; center: [number, number] }) => ({
        placeName: f.place_name,
        lng: f.center[0],
        lat: f.center[1],
      })
    );
    setCandidates(results);
    if (results[0]) setSelected(results[0]);
  }

  async function submit() {
    if (!selected) {
      setError("Please search for and select the delivery address first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/ops/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_address: selected.placeName,
        delivery_lat: selected.lat,
        delivery_lng: selected.lng,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.order) {
      router.push(`/ops/orders/${data.order.id}`);
    } else {
      setError("Failed to create order.");
    }
  }

  return (
    <div className="space-y-4">
      {error && <StatusBanner tone="danger">{error}</StatusBanner>}
      <input
        placeholder="Customer name"
        value={customerName}
        onChange={(e) => setCustomerName(e.target.value)}
        className="w-full rounded-lg border border-brand-navy/30 px-4 py-2"
      />
      <input
        placeholder="Customer phone"
        value={customerPhone}
        onChange={(e) => setCustomerPhone(e.target.value)}
        className="w-full rounded-lg border border-brand-navy/30 px-4 py-2"
      />
      <div className="flex gap-2">
        <input
          placeholder="Delivery address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="flex-1 rounded-lg border border-brand-navy/30 px-4 py-2"
        />
        <Button variant="accent-outline" onClick={searchAddress}>
          Search
        </Button>
      </div>
      {candidates.length > 0 && (
        <select
          className="w-full rounded-lg border border-brand-navy/30 px-4 py-2"
          value={selected?.placeName}
          onChange={(e) => setSelected(candidates.find((c) => c.placeName === e.target.value) ?? null)}
        >
          {candidates.map((c) => (
            <option key={c.placeName} value={c.placeName}>
              {c.placeName}
            </option>
          ))}
        </select>
      )}
      {selected && (
        <div className="h-64 overflow-hidden rounded-lg border border-brand-navy/10">
          <TrackingMap
            markers={[{ id: "pin", lat: selected.lat, lng: selected.lng, color: "#0A192F" }]}
            defaultCenter={[selected.lng, selected.lat]}
          />
        </div>
      )}
      <Button className="w-full" onClick={submit} disabled={submitting}>
        {submitting ? "Creating…" : "Create Order"}
      </Button>
    </div>
  );
}
