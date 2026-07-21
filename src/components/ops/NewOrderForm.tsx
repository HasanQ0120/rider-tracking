"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { TrackingMap } from "@/components/map/TrackingMap";

type GeocodeResult = { placeName: string; lat: number; lng: number };

// Nominatim can return multiple candidates with the identical display_name
// (e.g. a landmark spanning several address ranges) -- placeName alone
// isn't a safe React key or <select> value, so combine it with coordinates.
function candidateKey(c: GeocodeResult): string {
  return `${c.placeName}__${c.lat}__${c.lng}`;
}

export function NewOrderForm() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [candidates, setCandidates] = useState<GeocodeResult[]>([]);
  const [selected, setSelected] = useState<GeocodeResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function searchAddress() {
    if (!address.trim()) return;
    setError(null);
    setSearching(true);
    setCandidates([]);
    setSelected(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
      if (res.status === 429) {
        setError("Please wait a moment and try again.");
        return;
      }
      const data = await res.json();
      if (data.status !== "ok") {
        setError("Failed to search for that address.");
        return;
      }
      const results: GeocodeResult[] = data.results;
      setCandidates(results);
      if (results[0]) setSelected(results[0]);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }

  async function submit() {
    if (!selected) {
      setError("Please search for and select the delivery address first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
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
      if (data.order) {
        router.push(`/ops/orders/${data.order.id}`);
      } else {
        setError("Failed to create order.");
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <StatusBanner tone="danger">{error}</StatusBanner>}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-brand-navy/70">Customer</h2>
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
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-brand-navy/70">Delivery Address</h2>
        <div className="flex gap-2">
          <input
            placeholder="Search for an address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchAddress()}
            className="flex-1 rounded-lg border border-brand-navy/30 px-4 py-2"
          />
          <Button variant="accent-outline" onClick={searchAddress} disabled={searching || !address.trim()}>
            {searching ? "Searching…" : "Search"}
          </Button>
        </div>

        {searched && !searching && candidates.length === 0 && (
          <StatusBanner tone="warning">
            No matching address found. Try a more specific search (e.g. include city/area).
          </StatusBanner>
        )}

        {candidates.length > 0 && (
          <>
            <label className="block text-xs text-brand-navy/60">
              {candidates.length} result{candidates.length > 1 ? "s" : ""} found — confirm the right one:
            </label>
            <select
              className="w-full rounded-lg border border-brand-navy/30 px-4 py-2"
              value={selected ? candidateKey(selected) : ""}
              onChange={(e) =>
                setSelected(candidates.find((c) => candidateKey(c) === e.target.value) ?? null)
              }
            >
              {candidates.map((c) => (
                <option key={candidateKey(c)} value={candidateKey(c)}>
                  {c.placeName}
                </option>
              ))}
            </select>
            {selected && (
              <div className="h-64 overflow-hidden rounded-lg border border-brand-navy/10">
                <TrackingMap
                  markers={[{ id: "pin", lat: selected.lat, lng: selected.lng, color: "#0A192F" }]}
                  defaultCenter={[selected.lat, selected.lng]}
                />
              </div>
            )}
          </>
        )}
      </div>

      <Button className="w-full" onClick={submit} disabled={submitting || !selected}>
        {submitting ? "Creating…" : "Create Order"}
      </Button>
    </div>
  );
}
