"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { TrackingMap } from "@/components/map/TrackingMap";
import { createAuthBrowserClient } from "@/lib/supabase/browserAuth";
import { DEFAULT_DUTY_CHECKIN_RADIUS_M } from "@/lib/config";

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
  initialCheckinRadiusM,
}: {
  tenantId: string;
  initialAutoAssignEnabled: boolean;
  initialPickupAddress: string | null;
  initialPickupLat: number | null;
  initialPickupLng: number | null;
  initialCheckinRadiusM: number | null;
}) {
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(initialAutoAssignEnabled);
  const [pickupAddress, setPickupAddress] = useState(initialPickupAddress);
  const [pickupLat, setPickupLat] = useState(initialPickupLat);
  const [pickupLng, setPickupLng] = useState(initialPickupLng);
  const [checkinRadiusM, setCheckinRadiusM] = useState(
    initialCheckinRadiusM ?? DEFAULT_DUTY_CHECKIN_RADIUS_M
  );
  const [radiusInput, setRadiusInput] = useState(String(checkinRadiusM));
  const [savingRadius, setSavingRadius] = useState(false);
  const [radiusSaved, setRadiusSaved] = useState(false);

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
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(addressQuery)}`);
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
      const supabase = createAuthBrowserClient();
      const { error: updateError } = await supabase
        .from("tenants")
        .update({
          default_pickup_address: selected.placeName,
          default_pickup_lat: selected.lat,
          default_pickup_lng: selected.lng,
        })
        .eq("id", tenantId);
      if (updateError) {
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

  async function saveCheckinRadius() {
    const parsed = Number(radiusInput);
    if (!Number.isFinite(parsed) || parsed < 50 || parsed > 2000) {
      setError("Check-in radius must be between 50 and 2000 meters.");
      return;
    }
    setSavingRadius(true);
    setError(null);
    try {
      const supabase = createAuthBrowserClient();
      const { error: updateError } = await supabase
        .from("tenants")
        .update({ duty_checkin_radius_m: parsed })
        .eq("id", tenantId);
      if (updateError) {
        setError("Failed to save check-in radius.");
        return;
      }
      setCheckinRadiusM(parsed);
      setRadiusInput(String(parsed));
      setRadiusSaved(true);
      setTimeout(() => setRadiusSaved(false), 2000);
    } finally {
      setSavingRadius(false);
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
      const supabase = createAuthBrowserClient();
      const next = !autoAssignEnabled;
      const { error: updateError } = await supabase
        .from("tenants")
        .update({ auto_assign_enabled: next })
        .eq("id", tenantId);
      if (updateError) {
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

      <Card title="Pickup Location">
        <p className="mb-3 text-sm text-white/50">
          Where riders pick up orders from. Used as the center point for automatic rider
          assignment.
        </p>
        {hasPickup && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Current
              </p>
              <p className="mt-1 text-sm text-white">{pickupAddress}</p>
            </div>
            <Button
              variant="accent-outline"
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
            </Button>
          </div>
        )}
        {showPickupSearch && (
          <div className="animate-fade-in space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Search address…"
                value={addressQuery}
                onChange={(e) => setAddressQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchAddress()}
                className="flex-1"
              />
              <Button
                variant="accent-outline"
                onClick={searchAddress}
                disabled={searching || !addressQuery.trim()}
              >
                {searching && <Spinner className="h-4 w-4" />}
                {searching ? "Searching…" : "Search"}
              </Button>
            </div>

            {searched && !searching && candidates.length === 0 && (
              <StatusBanner tone="warning">No matching address found.</StatusBanner>
            )}

            {candidates.length > 1 && (
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
            )}

            {selected && (
              <div className="space-y-2">
                <div className="h-64 overflow-hidden rounded-xl border border-white/10 shadow-sm">
                  <TrackingMap
                    markers={[{ id: "pin", lat: selected.lat, lng: selected.lng, color: "#FFD700", draggable: true }]}
                    defaultCenter={[selected.lat, selected.lng]}
                    onMapClick={handleMapClick}
                    onMarkerDrag={handlePinDrag}
                  />
                </div>
                <p className="text-xs text-white/40">
                  📍 {selected.lat.toFixed(6)}, {selected.lng.toFixed(6)} — click the map or drag the
                  pin if this isn't the exact spot.
                </p>
                <Button onClick={savePickup} disabled={saving}>
                  {saving && <Spinner className="h-4 w-4" />}
                  {saving ? "Saving…" : saved ? "Saved!" : "Save Pickup Location"}
                </Button>
              </div>
            )}

            {!selected && (
              <div className="h-64 overflow-hidden rounded-xl border border-white/10 shadow-sm">
                <TrackingMap
                  markers={[]}
                  defaultCenter={DEFAULT_MAP_CENTER}
                  onMapClick={handleMapClick}
                />
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="Rider Check-In">
        <p className="mb-3 text-sm text-white/50">
          How close a rider must be to your pickup location to go on duty. Falls back to the
          platform default ({DEFAULT_DUTY_CHECKIN_RADIUS_M}m) until you set your own.
        </p>
        {!hasPickup && (
          <p className="mb-3 text-xs text-white/40">
            Set a pickup location above first — without one, riders can go on duty from anywhere.
          </p>
        )}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type="number"
              min={50}
              max={2000}
              value={radiusInput}
              onChange={(e) => setRadiusInput(e.target.value)}
              className="pr-10"
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-white/40">
              m
            </span>
          </div>
          <Button
            variant="accent-outline"
            onClick={saveCheckinRadius}
            disabled={savingRadius || radiusInput === String(checkinRadiusM)}
          >
            {savingRadius && <Spinner className="h-4 w-4" />}
            {savingRadius ? "Saving…" : radiusSaved ? "Saved!" : "Save"}
          </Button>
        </div>
      </Card>

      <Card title="Automatic Assignment">
        <p className="mb-4 text-sm text-white/50">
          When on, new orders are automatically assigned to whichever available rider is nearest
          your pickup location and carrying the fewest active deliveries, instead of assigning
          manually.
        </p>
        <button
          onClick={toggleAutoAssign}
          disabled={togglingAutoAssign}
          className={`flex w-full items-center justify-between rounded-lg border p-3 transition-colors disabled:opacity-50 ${
            autoAssignEnabled
              ? "border-status-success/30 bg-status-success/10"
              : "border-white/10 bg-white/5"
          }`}
        >
          <span className="text-sm font-medium text-white">
            {autoAssignEnabled ? "On" : "Off"}
          </span>
          <span
            className={`relative h-6 w-11 rounded-full transition-colors ${
              autoAssignEnabled ? "bg-status-success" : "bg-white/20"
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
          <p className="mt-2 text-xs text-white/40">Set a pickup location above first.</p>
        )}
      </Card>
    </div>
  );
}
