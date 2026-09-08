"use client";

import { useState } from "react";
import { MerchantButton, MerchantCard, MerchantInput, MerchantSelect } from "@/components/merchant/MerchantUi";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { TrackingMap } from "@/components/map/TrackingMap";
import { apiFetch, publicApiFetch } from "@/lib/api/browserFetch";

// Fallback starting viewport before any address has been searched or
// clicked, matching the same constant used for the same reason in
// NewOrderForm.tsx.
const DEFAULT_MAP_CENTER: [number, number] = [24.9204, 67.0946];

type GeocodeResult = { placeName: string; lat: number; lng: number };

function candidateKey(c: GeocodeResult): string {
  return `${c.placeName}__${c.lat}__${c.lng}`;
}

export function AutoAssignSettings({
  tenantId,
  initialAutoAssignEnabled,
  initialPickupAddress,
  initialPickupLat,
  initialPickupLng,
}: {
  tenantId: string;
  initialAutoAssignEnabled: boolean;
  initialPickupAddress: string | null;
  initialPickupLat: number | null;
  initialPickupLng: number | null;
}) {
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(initialAutoAssignEnabled);
  const [pickupAddress, setPickupAddress] = useState(initialPickupAddress);
  const [pickupLat, setPickupLat] = useState(initialPickupLat);
  const [pickupLng, setPickupLng] = useState(initialPickupLng);

  const [changingPickup, setChangingPickup] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [candidates, setCandidates] = useState<GeocodeResult[]>([]);
  const [selected, setSelected] = useState<GeocodeResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [togglingAutoAssign, setTogglingAutoAssign] = useState(false);

  const hasPickup = pickupLat != null && pickupLng != null;
  const showPickupSearch = !hasPickup || changingPickup;

  function cancelChangingPickup() {
    setChangingPickup(false);
    setAddressQuery("");
    setCandidates([]);
    setSelected(null);
    setSearched(false);
    setError(null);
  }

  async function searchAddress() {
    if (!addressQuery.trim()) return;
    setError(null);
    setSearching(true);
    setCandidates([]);
    setSelected(null);
    setSearched(false);
    try {
      const res = await publicApiFetch(
        `/api/geocode?q=${encodeURIComponent(addressQuery.trim())}`
      );
      const data = await res.json().catch(() => null);
      if (res.status === 429 || data?.status === "rate_limited") {
        setError("Please wait a second and search again (map provider rate limit).");
        return;
      }
      if (!res.ok || data?.status !== "ok") {
        setError("Failed to search for that address. You can still click the map to place a pin.");
        return;
      }
      const results: GeocodeResult[] = data.results ?? [];
      setCandidates(results);
      if (results[0]) setSelected(results[0]);
      setSearched(true);
    } catch {
      setError("Couldn't reach the server. Check that the API is running, or click the map to place a pin.");
    } finally {
      setSearching(false);
    }
  }

  // Dragging fine-tunes an existing pin by a few meters -- keep whatever
  // label it already had (search result text), only the coordinates move.
  function handlePinDrag(_id: string, lat: number, lng: number) {
    setSelected((prev) => (prev ? { ...prev, lat, lng } : prev));
  }

  // A map click can jump anywhere, bypassing search entirely -- treat it as
  // a fresh manual placement. This is what actually fixes a wrong/ambiguous
  // geocode match (e.g. a business-name search landing on the wrong branch)
  // instead of just re-searching and hoping for a different top result.
  function handleMapClick(lat: number, lng: number) {
    setSelected({
      placeName: addressQuery.trim() || `Custom location (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
      lat,
      lng,
    });
  }

  async function savePickup() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/merchant/settings", {
        method: "PATCH",
        body: JSON.stringify({
          defaultPickupAddress: selected.placeName,
          defaultPickupLat: selected.lat,
          defaultPickupLng: selected.lng,
        }),
      });
      const data = await res.json();
      if (data.status !== "ok") {
        setError("Failed to save pickup location.");
        return;
      }
      setPickupAddress(selected.placeName);
      setPickupLat(selected.lat);
      setPickupLng(selected.lng);
      setCandidates([]);
      setSelected(null);
      setAddressQuery("");
      setSearched(false);
      setChangingPickup(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function toggleAutoAssign() {
    if (!hasPickup && !autoAssignEnabled) {
      setError("Set a pickup location before turning on automatic assignment.");
      return;
    }
    setTogglingAutoAssign(true);
    setError(null);
    try {
      const next = !autoAssignEnabled;
      const res = await apiFetch("/api/merchant/settings", {
        method: "PATCH",
        body: JSON.stringify({ autoAssignEnabled: next }),
      });
      const data = await res.json();
      if (data.status !== "ok") {
        setError("Failed to update automatic assignment.");
        return;
      }
      setAutoAssignEnabled(next);
    } finally {
      setTogglingAutoAssign(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <StatusBanner tone="danger">{error}</StatusBanner>}

      <MerchantCard title="Pickup location" id="pickup-location" subtitle="Center point for automatic rider assignment.">
        <p className="mb-3 text-sm text-slate-500 sr-only">
          Where riders pick up orders from. Used as the center point for automatic rider
          assignment.
        </p>
        {hasPickup && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Current
              </p>
              <p className="mt-1 text-sm text-slate-900">{pickupAddress}</p>
            </div>
            <MerchantButton
              variant="secondary"
              size="sm"
              className="flex-shrink-0"
              onClick={() => {
                if (changingPickup) {
                  cancelChangingPickup();
                  return;
                }
                // Pre-populate the map with the existing pin so it's
                // immediately visible and draggable, instead of starting
                // from a blank map that only fills in after a fresh search.
                if (pickupLat != null && pickupLng != null) {
                  setSelected({ placeName: pickupAddress ?? "", lat: pickupLat, lng: pickupLng });
                }
                setChangingPickup(true);
              }}
            >
              {changingPickup ? "Cancel" : "Change"}
            </MerchantButton>
          </div>
        )}
        {showPickupSearch && (
          <div className="animate-fade-in space-y-3">
            <div className="flex gap-2">
              <MerchantInput
                placeholder="Search address…"
                value={addressQuery}
                onChange={(e) => setAddressQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchAddress()}
                className="flex-1"
              />
              <MerchantButton
                variant="secondary"
                onClick={searchAddress}
                disabled={searching || !addressQuery.trim()}
              >
                {searching && <Spinner className="h-4 w-4" />}
                {searching ? "Searching…" : "Search"}
              </MerchantButton>
            </div>

            {searched && !searching && candidates.length === 0 && (
              <StatusBanner tone="warning">No matching address found.</StatusBanner>
            )}

            {candidates.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  {candidates.length} result{candidates.length > 1 ? "s" : ""} found — pick one from
                  the list, or click the map to adjust.
                </p>
                <MerchantSelect
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
                </MerchantSelect>
              </div>
            )}

            {selected && (
              <div className="space-y-2">
                <div className="h-64 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                  <TrackingMap
                    markers={[{ id: "pin", lat: selected.lat, lng: selected.lng, color: "#FFD700", draggable: true }]}
                    defaultCenter={[selected.lat, selected.lng]}
                    onMapClick={handleMapClick}
                    onMarkerDrag={handlePinDrag}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {selected.lat.toFixed(6)}, {selected.lng.toFixed(6)} — click the map or drag the
                  pin if this isn&apos;t the exact spot.
                </p>
                <MerchantButton onClick={savePickup} disabled={saving}>
                  {saving && <Spinner className="h-4 w-4" />}
                  {saving ? "Saving…" : saved ? "Saved!" : "Save Pickup Location"}
                </MerchantButton>
              </div>
            )}

            {!selected && (
              <div className="space-y-2">
                <div className="h-64 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                  <TrackingMap
                    markers={[]}
                    defaultCenter={DEFAULT_MAP_CENTER}
                    onMapClick={handleMapClick}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Search failed or no results? Click the map to drop a pin, then save.
                </p>
              </div>
            )}
          </div>
        )}
      </MerchantCard>

      <MerchantCard title="Automatic assignment" id="automatic-assignment" subtitle="Assign new orders to the nearest available rider automatically.">
        <p className="mb-4 text-sm text-slate-500 sr-only">
          When on, new orders are automatically assigned to whichever available rider is nearest
          your pickup location and carrying the fewest active deliveries, instead of assigning
          manually.
        </p>
        <button
          onClick={toggleAutoAssign}
          disabled={togglingAutoAssign}
          className={`flex w-full items-center justify-between rounded-lg border p-3 transition-colors disabled:opacity-50 ${
            autoAssignEnabled
              ? "border-emerald-200 bg-emerald-50"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <span className="text-sm font-medium text-slate-900">
            {autoAssignEnabled ? "On" : "Off"}
          </span>
          <span
            className={`relative h-6 w-11 rounded-full transition-colors ${
              autoAssignEnabled ? "bg-emerald-500" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                autoAssignEnabled ? "translate-x-5" : ""
              }`}
            />
          </span>
        </button>
        {!hasPickup && !autoAssignEnabled && (
          <p className="mt-2 text-xs text-slate-500">Set a pickup location above first.</p>
        )}
      </MerchantCard>
    </div>
  );
}
