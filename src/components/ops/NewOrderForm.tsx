"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { TrackingMap } from "@/components/map/TrackingMap";

type GeocodeResult = { placeName: string; lat: number; lng: number };

// Fallback starting viewport before any address has been searched or
// clicked -- purely a starting point for panning/zooming, not a business
// rule. Centered on Gulshan-e-Iqbal, Karachi, matching where this app has
// actually been field-tested; change freely if the real service area
// differs.
const DEFAULT_MAP_CENTER: [number, number] = [24.9204, 67.0946];

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

  // Dragging fine-tunes an existing pin by a few meters -- keep whatever
  // label it already had (search result text, or a prior manual label),
  // only the coordinates move.
  function handlePinDrag(_id: string, lat: number, lng: number) {
    setSelected((prev) => (prev ? { ...prev, lat, lng } : prev));
  }

  // A map click can jump anywhere, bypassing search entirely -- treat it as
  // a fresh manual placement. Use whatever's currently typed in the search
  // box as the label if there is any, since ops often types an address
  // before giving up on search results; otherwise fall back to the
  // coordinates themselves so delivery_address is never left blank.
  function handleMapClick(lat: number, lng: number) {
    setSelected({
      placeName: address.trim() || `Custom location (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
      lat,
      lng,
    });
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

      <Card title="Customer">
        <div className="space-y-3">
          <Input
            placeholder="Customer name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
          <Input
            placeholder="Customer phone"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
        </div>
      </Card>

      <Card title="Delivery Address">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Search for an address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchAddress()}
              className="flex-1"
            />
            <Button variant="accent-outline" onClick={searchAddress} disabled={searching || !address.trim()}>
              {searching && <Spinner className="h-4 w-4" />}
              {searching ? "Searching…" : "Search"}
            </Button>
          </div>

          {searched && !searching && candidates.length === 0 && (
            <StatusBanner tone="warning">
              No matching address found. You can place the pin manually on the map below instead.
            </StatusBanner>
          )}

          {candidates.length > 0 && (
            <div className="animate-fade-in space-y-3">
              <label className="block text-xs text-brand-navy/60">
                {candidates.length} result{candidates.length > 1 ? "s" : ""} found — confirm the right one:
              </label>
              <Select
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
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs text-brand-navy/60">
              {selected
                ? "Drag the pin to fine-tune its exact position, or click elsewhere to move it."
                : "Or click anywhere on the map to place the delivery pin manually."}
            </label>
            <div className="h-80 overflow-hidden rounded-lg border border-brand-navy/10 shadow-sm">
              <TrackingMap
                markers={
                  selected
                    ? [{ id: "pin", lat: selected.lat, lng: selected.lng, color: "#0A192F", draggable: true }]
                    : []
                }
                defaultCenter={selected ? [selected.lat, selected.lng] : DEFAULT_MAP_CENTER}
                onMapClick={handleMapClick}
                onMarkerDrag={handlePinDrag}
              />
            </div>
            {selected && (
              <p className="text-xs text-brand-navy/50">
                Pin: {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
              </p>
            )}
          </div>
        </div>
      </Card>

      <Button className="w-full" onClick={submit} disabled={submitting || !selected}>
        {submitting && <Spinner className="h-4 w-4" />}
        {submitting ? "Creating…" : "Create Order"}
      </Button>
    </div>
  );
}
