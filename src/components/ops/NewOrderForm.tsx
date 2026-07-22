"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { TrackingMap } from "@/components/map/TrackingMap";
import { cleanPhoneInput, isValidPakistaniMobile, PK_MOBILE_HINT } from "@/lib/phone";
import { scrollToError } from "@/lib/scrollToError";

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

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">{children}</label>;
}

export function NewOrderForm() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [candidates, setCandidates] = useState<GeocodeResult[]>([]);
  const [selected, setSelected] = useState<GeocodeResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const errorBannerRef = useRef<HTMLDivElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  function showFormError(message: string) {
    setError(message);
    // Deferred a tick -- the banner doesn't exist in the DOM yet on the
    // render that sets it, so scrolling immediately would target nothing.
    requestAnimationFrame(() => scrollToError(errorBannerRef));
  }

  function showPhoneError(message: string) {
    setPhoneError(message);
    requestAnimationFrame(() => scrollToError(phoneInputRef));
  }

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
      showFormError("Please search for and select the delivery address first.");
      return;
    }
    if (!isValidPakistaniMobile(customerPhone)) {
      showPhoneError(PK_MOBILE_HINT);
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
          customer_phone: cleanPhoneInput(customerPhone),
          delivery_address: selected.placeName,
          delivery_lat: selected.lat,
          delivery_lng: selected.lng,
          address_detail: addressDetail,
        }),
      });
      const data = await res.json();
      if (data.order) {
        router.push(`/ops/orders/${data.order.id}`);
      } else if (data.status === "invalid_phone") {
        showPhoneError(PK_MOBILE_HINT);
      } else {
        showFormError("Failed to create order.");
      }
    } catch {
      showFormError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div ref={errorBannerRef}>
          <StatusBanner tone="danger">{error}</StatusBanner>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card title="Customer Information">
            <div className="space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input
                  placeholder="e.g. Fatima Zahra"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div>
                <Label>Pakistani Phone</Label>
                <Input
                  ref={phoneInputRef}
                  placeholder="0300-1234567"
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    if (phoneError) setPhoneError(null);
                  }}
                  onBlur={() => {
                    if (customerPhone.trim() && !isValidPakistaniMobile(customerPhone)) {
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
            </div>
          </Card>

          <Card title="Delivery Location">
            <div className="space-y-4">
              <div>
                <Label>Search Address</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search Karachi address…"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchAddress()}
                    className="flex-1"
                  />
                  <Button
                    variant="accent-outline"
                    onClick={searchAddress}
                    disabled={searching || !address.trim()}
                  >
                    {searching && <Spinner className="h-4 w-4" />}
                    {searching ? "Searching…" : "Search"}
                  </Button>
                </div>
              </div>

              {searched && !searching && candidates.length === 0 && (
                <StatusBanner tone="warning">
                  No matching address found. You can place the pin manually on the map instead.
                </StatusBanner>
              )}

              {candidates.length > 0 && (
                <div className="animate-fade-in space-y-2">
                  <Label>
                    {candidates.length} result{candidates.length > 1 ? "s" : ""} found — confirm the right one
                  </Label>
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

              <div>
                <Label>Delivery Address</Label>
                <Input placeholder="Full delivery address" value={selected?.placeName ?? ""} readOnly />
              </div>

              <div>
                <Label>Plot / House / Floor</Label>
                <Input
                  placeholder="e.g. House 12, Floor 2, near the mosque…"
                  value={addressDetail}
                  onChange={(e) => setAddressDetail(e.target.value)}
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-2">
          <div className="h-80 overflow-hidden rounded-xl border border-white/10 shadow-sm lg:h-full lg:min-h-[420px]">
            <TrackingMap
              markers={
                selected
                  ? [{ id: "pin", lat: selected.lat, lng: selected.lng, color: "#FFD700", draggable: true }]
                  : []
              }
              defaultCenter={selected ? [selected.lat, selected.lng] : DEFAULT_MAP_CENTER}
              onMapClick={handleMapClick}
              onMarkerDrag={handlePinDrag}
            />
          </div>
          <p className="text-xs text-white/40">
            {selected
              ? `📍 ${selected.lat.toFixed(6)}, ${selected.lng.toFixed(6)}`
              : "Click the map or drag the pin to refine the exact delivery location"}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link href="/ops/orders">
          <Button variant="accent-outline">Cancel</Button>
        </Link>
        <Button onClick={submit} disabled={submitting || !selected}>
          {submitting && <Spinner className="h-4 w-4" />}
          {submitting ? "Creating…" : "Create Order"}
        </Button>
      </div>
    </div>
  );
}
