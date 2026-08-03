"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { RiderLocationPanel } from "@/components/ops/RiderLocationPanel";
import { AllRidersMapPanel } from "@/components/ops/AllRidersMapPanel";
import { cleanPhoneInput, isValidPakistaniMobile, PK_MOBILE_HINT } from "@/lib/phone";
import { scrollToError } from "@/lib/scrollToError";

type RowError = { line: number; reason: string };
type BulkResult = { imported: number; errors: RowError[] };

type Rider = {
  id: string;
  name: string;
  phone: string;
  license_plate: string | null;
  active: boolean;
  available?: boolean;
  availability_token?: string | null;
  created_at: string;
  deliveredCount?: number;
  activeCount?: number;
};

type MapMode = { kind: "closed" } | { kind: "all" } | { kind: "single"; riderId: string };

// Avatar + name/phone/plate -- shared between each list row and the
// single-rider detail card so the two views never drift out of sync.
function RiderInfo({ r }: { r: Rider }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-brand-navy text-sm font-semibold text-white">
        {r.name.charAt(0).toUpperCase()}
      </div>
      <div>
        <p className="font-medium text-white">{r.name}</p>
        <p className="text-xs text-white/50">
          {r.phone}
          {r.license_plate && <span className="ml-2 font-mono text-brand-gold/80">{r.license_plate}</span>}
        </p>
      </div>
    </div>
  );
}

// Idle/active + accepting-orders status -- also shared between the list
// row and the detail card.
function RiderBadges({ r }: { r: Rider }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-white/40">{r.deliveredCount ?? 0} deliveries</span>
      {(r.activeCount ?? 0) > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {r.activeCount} active
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/50">
          Idle
        </span>
      )}
      {r.available ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-status-success/15 px-2.5 py-1 text-xs font-medium text-status-success">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          Accepting Orders
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/40">
          Not Accepting Orders
        </span>
      )}
    </div>
  );
}

export function RidersPanel({
  initialRiders,
  createEndpoint = "/api/ops/riders",
  bulkImportEndpoint = "/api/ops/riders/bulk",
  locationEndpointBase = "/api/ops/riders",
}: {
  initialRiders: Rider[];
  // Lets the merchant dashboard reuse this exact form/UI against its own
  // tenant-scoped API routes instead of the ops ones -- defaults keep ops's
  // existing behavior completely unchanged.
  createEndpoint?: string;
  bulkImportEndpoint?: string;
  locationEndpointBase?: string;
}) {
  const [riders, setRiders] = useState(initialRiders);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>({ kind: "closed" });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<BulkResult | null>(null);
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedRider = mapMode.kind === "single" ? riders.find((r) => r.id === mapMode.riderId) ?? null : null;

  async function copyAvailabilityLink(rider: Rider) {
    if (!rider.availability_token) return;
    const url = `${window.location.origin}/rider/availability/${rider.availability_token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(rider.id);
    setTimeout(() => setCopiedId((id) => (id === rider.id ? null : id)), 2000);
  }

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
    const res = await fetch(createEndpoint, {
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

  async function importCsv(file: File) {
    setImportFileError(null);
    setImportResult(null);
    setImporting(true);
    try {
      const csv = await file.text();
      const res = await fetch(bulkImportEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json();
      if (data.status !== "ok") {
        setImportFileError("Failed to import this file.");
        return;
      }
      if (data.riders?.length) {
        setRiders([
          ...data.riders.map((r: Rider) => ({ ...r, deliveredCount: 0, activeCount: 0 })),
          ...riders,
        ]);
      }
      setImportResult({ imported: data.imported ?? 0, errors: data.errors ?? [] });
    } catch {
      setImportFileError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div
      className={
        mapMode.kind !== "closed"
          // Breaks out of the two nested centered max-width containers this
          // page sits inside (the ops/merchant layout's max-w-5xl and this
          // page's own max-w-2xl) so the map can actually use the screen's
          // width instead of a slice of an already-narrow centered column.
          // Math: margin-left cancels out through any number of `mx-auto`
          // ancestors because percentage margins resolve against the
          // immediate parent's width, not the viewport -- see the -mx trick.
          ? "w-screen max-w-none space-y-6 px-6 ml-[calc(50%_-_50vw)]"
          : "space-y-6"
      }
    >
      <div className="flex items-center justify-end gap-2">
        <Button
          variant={mapMode.kind === "all" ? "accent" : "accent-outline"}
          onClick={() => setMapMode((m) => (m.kind === "all" ? { kind: "closed" } : { kind: "all" }))}
        >
          {mapMode.kind === "all" ? "Hide Map" : "Show All"}
        </Button>
        <Button
          variant="accent-outline"
          onClick={() => {
            setShowBulkImport((v) => !v);
            setShowAddForm(false);
          }}
        >
          {showBulkImport ? "Cancel" : "Import CSV"}
        </Button>
        <Button
          onClick={() => {
            setShowAddForm((v) => !v);
            setShowBulkImport(false);
          }}
        >
          {showAddForm ? "Cancel" : "+ Add Rider"}
        </Button>
      </div>

      {showBulkImport && (
        <Card title="Bulk Import Riders" className="animate-slide-up">
          <p className="mb-3 text-sm text-white/50">
            A CSV file with columns <code className="text-white/70">name</code>,{" "}
            <code className="text-white/70">phone</code>, and{" "}
            <code className="text-white/70">license_plate</code> (any column order, header row
            required).
          </p>
          {importFileError && (
            <div className="mb-3">
              <StatusBanner tone="danger">{importFileError}</StatusBanner>
            </div>
          )}
          {importResult && (
            <div className="mb-3 space-y-2">
              <StatusBanner tone={importResult.errors.length > 0 ? "warning" : "success"}>
                Imported {importResult.imported} rider{importResult.imported === 1 ? "" : "s"}.
                {importResult.errors.length > 0 &&
                  ` ${importResult.errors.length} row${importResult.errors.length === 1 ? "" : "s"} skipped.`}
              </StatusBanner>
              {importResult.errors.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-3">
                  {importResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-white/60">
                      Line {e.line}: {e.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            disabled={importing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importCsv(file);
            }}
            className="block w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-gold file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-navy"
          />
          {importing && (
            <p className="mt-2 flex items-center gap-2 text-sm text-white/50">
              <Spinner className="h-4 w-4" /> Importing…
            </p>
          )}
        </Card>
      )}

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

      <div className={`flex gap-4 ${mapMode.kind !== "closed" ? "h-[calc(100vh-260px)]" : ""}`}>
        <div
          className={`min-w-0 space-y-6 transition-all duration-300 ${
            mapMode.kind !== "closed" ? "w-full max-w-sm shrink-0 overflow-y-auto" : "max-w-full flex-1"
          }`}
        >
          {mapMode.kind === "single" && selectedRider ? (
            <div className="animate-fade-in space-y-4 rounded-xl border border-brand-gold bg-brand-gold/10 p-4">
              <Button variant="accent-outline" size="sm" onClick={() => setMapMode({ kind: "all" })}>
                ← Back to all riders
              </Button>
              <RiderInfo r={selectedRider} />
              <RiderBadges r={selectedRider} />
              {selectedRider.availability_token && (
                <Button variant="accent-outline" size="sm" onClick={() => copyAvailabilityLink(selectedRider)}>
                  {copiedId === selectedRider.id ? "Copied!" : "Copy Link"}
                </Button>
              )}
            </div>
          ) : riders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-white/50">
              No riders yet.
            </div>
          ) : (
            <div className="space-y-3">
              {riders.map((r) => (
                <div key={r.id} className="animate-fade-in space-y-3 rounded-xl border border-white/10 bg-surface-raised p-4 transition-colors hover:bg-white/5">
                  <RiderInfo r={r} />
                  <RiderBadges r={r} />
                  <div className="flex flex-wrap gap-2">
                    {r.availability_token && (
                      <Button variant="accent-outline" size="sm" onClick={() => copyAvailabilityLink(r)}>
                        {copiedId === r.id ? "Copied!" : "Copy Link"}
                      </Button>
                    )}
                    <Button variant="accent-outline" size="sm" onClick={() => setMapMode({ kind: "single", riderId: r.id })}>
                      Track Location
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {mapMode.kind !== "single" && <p className="text-xs text-white/40">{riders.length} riders registered</p>}
        </div>

        {mapMode.kind !== "closed" && (
          // No explicit height here -- it's a flex child of the row above,
          // which now has a real height (h-[calc(100vh-260px)]) and the
          // row's default align-items: stretch fills it automatically.
          <div className="flex-1 animate-fade-in">
            {mapMode.kind === "all" ? (
              <AllRidersMapPanel
                riders={riders.map((r) => ({ id: r.id, name: r.name }))}
                endpointBase={locationEndpointBase}
                onClose={() => setMapMode({ kind: "closed" })}
                onSelectRider={(riderId) => setMapMode({ kind: "single", riderId })}
              />
            ) : selectedRider ? (
              <RiderLocationPanel
                key={selectedRider.id}
                riderId={selectedRider.id}
                riderName={selectedRider.name}
                endpointBase={locationEndpointBase}
                onClose={() => setMapMode({ kind: "closed" })}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
