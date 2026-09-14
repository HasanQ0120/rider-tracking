"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { MerchantCard, MerchantInput, MerchantButton, MerchantSelect } from "@/components/merchant/MerchantUi";
import { useMerchantSearch } from "@/components/merchant/MerchantSearchContext";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { RiderLocationPanel } from "@/components/ops/RiderLocationPanel";
import { AllRidersMapPanel } from "@/components/ops/AllRidersMapPanel";
import { apiFetch } from "@/lib/api/browserFetch";
import { cleanPhoneInput, isValidPakistaniMobile, PK_MOBILE_HINT } from "@/lib/phone";
import { parseRiderCsvClient } from "@/lib/riderCsvClient";
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
  branch_id?: string | null;
  created_at: string;
  deliveredCount?: number;
  activeCount?: number;
};

type BranchOption = { id: string; name: string; code: string; active: boolean };

type MapMode = { kind: "closed" } | { kind: "all" } | { kind: "single"; riderId: string };

// Avatar + name/phone/plate -- shared between each list row and the
// single-rider detail card so the two views never drift out of sync.
function RiderInfo({
  r,
  light,
  branchLabel,
}: {
  r: Rider;
  light?: boolean;
  branchLabel?: string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          light
            ? "border border-slate-200 bg-slate-100 text-slate-700"
            : "border border-white/10 bg-brand-navy text-white"
        }`}
      >
        {r.name.charAt(0).toUpperCase()}
      </div>
      <div>
        <p className={`font-medium ${light ? "text-slate-900" : "text-white"}`}>{r.name}</p>
        <p className={`text-xs ${light ? "text-slate-500" : "text-white/50"}`}>
          {r.phone}
          {r.license_plate && (
            <span className={`ml-2 font-mono ${light ? "text-slate-600" : "text-brand-gold/80"}`}>
              {r.license_plate}
            </span>
          )}
        </p>
        {branchLabel ? (
          <p className={`mt-0.5 text-xs ${light ? "text-slate-400" : "text-white/40"}`}>{branchLabel}</p>
        ) : null}
      </div>
    </div>
  );
}

function RiderBadges({ r, light }: { r: Rider; light?: boolean }) {
  const idleCls = light
    ? "bg-slate-100 text-slate-600"
    : "bg-white/10 text-white/50";
  const mutedCls = light ? "text-slate-500" : "text-white/40";
  const notAcceptingCls = light
    ? "bg-slate-100 text-slate-500"
    : "bg-white/10 text-white/40";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!r.active && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-status-danger/15 px-2.5 py-1 text-xs font-medium text-status-danger">
          Inactive
        </span>
      )}
      <span className={`text-xs ${mutedCls}`}>{r.deliveredCount ?? 0} deliveries</span>
      {(r.activeCount ?? 0) > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-600">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {r.activeCount} active
        </span>
      ) : (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${idleCls}`}>
          Idle
        </span>
      )}
      {r.available ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          Accepting Orders
        </span>
      ) : (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${notAcceptingCls}`}>
          Not Accepting Orders
        </span>
      )}
    </div>
  );
}

export function RidersPanel({
  initialRiders,
  branches = [],
  createEndpoint = "/api/ops/riders",
  bulkImportEndpoint = "/api/ops/riders/bulk",
  locationEndpointBase = "/api/ops/riders",
  variant = "dark",
  layout = "default",
}: {
  initialRiders: Rider[];
  /** When provided, create/import require a branch and list can filter. */
  branches?: BranchOption[];
  createEndpoint?: string;
  bulkImportEndpoint?: string;
  locationEndpointBase?: string;
  variant?: "dark" | "light";
  layout?: "default" | "split";
}) {
  const isLight = variant === "light";
  const isSplit = layout === "split";
  const PanelCard = isLight ? MerchantCard : Card;
  const PanelInput = isLight ? MerchantInput : Input;
  const [riders, setRiders] = useState(initialRiders);
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [createBranchId, setCreateBranchId] = useState(
    () => branches.find((b) => b.active && b.code === "main")?.id ?? branches.find((b) => b.active)?.id ?? ""
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>({ kind: "closed" });
  const [localSearch, setLocalSearch] = useState("");
  const globalSearch = useMerchantSearch().query;
  const searchQuery = isLight && globalSearch.trim() ? globalSearch : localSearch;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [loginPinError, setLoginPinError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<BulkResult | null>(null);
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPlate, setEditPlate] = useState("");
  const [editPhoneError, setEditPhoneError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
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

  function startEdit(rider: Rider) {
    setEditingId(rider.id);
    setEditName(rider.name);
    setEditPhone(rider.phone);
    setEditPlate(rider.license_plate ?? "");
    setEditPhoneError(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    if (!isValidPakistaniMobile(editPhone)) {
      setEditPhoneError(PK_MOBILE_HINT);
      return;
    }
    setEditSaving(true);
    const res = await apiFetch(`${locationEndpointBase}/${editingId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: editName.trim(),
        phone: cleanPhoneInput(editPhone),
        license_plate: editPlate.trim() || null,
      }),
    });
    const data = await res.json();
    setEditSaving(false);
    if (data.status === "ok" && data.rider) {
      setRiders((prev) => prev.map((r) => (r.id === editingId ? { ...r, ...data.rider } : r)));
      setEditingId(null);
    } else if (data.status === "invalid_phone") {
      setEditPhoneError(PK_MOBILE_HINT);
    }
  }

  // Deactivating (not deleting) is the only safe option here -- every rider
  // in real use already has order history, and orders reference riders by
  // foreign key, so a true delete would either fail outright or corrupt
  // that history. This reuses the existing `active` flag that
  // auto-assignment already respects, and is fully reversible.
  async function toggleActive(rider: Rider) {
    setTogglingId(rider.id);
    const res = await apiFetch(`${locationEndpointBase}/${rider.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !rider.active }),
    });
    const data = await res.json();
    setTogglingId(null);
    if (data.status === "ok" && data.rider) {
      setRiders((prev) => prev.map((r) => (r.id === rider.id ? { ...r, ...data.rider } : r)));
    }
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
    if (!/^\d{6}$/.test(loginPin.trim())) {
      setLoginPinError("Login PIN must be exactly 6 digits.");
      return;
    }
    if (branches.length > 0 && !createBranchId) {
      setLoginPinError("Select a branch for this rider.");
      return;
    }
    setSubmitting(true);
    const res = await apiFetch(createEndpoint, {
      method: "POST",
      body: JSON.stringify({
        name,
        phone: cleanPhoneInput(phone),
        license_plate: licensePlate.trim(),
        login_pin: loginPin.trim(),
        ...(createBranchId ? { branch_id: createBranchId } : {}),
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.rider) {
      setRiders([{ ...data.rider, deliveredCount: 0, activeCount: 0 }, ...riders]);
      setName("");
      setPhone("");
      setLicensePlate("");
      setLoginPin("");
      setLoginPinError(null);
      setShowAddForm(false);
    } else if (data.status === "invalid_phone") {
      showPhoneError(PK_MOBILE_HINT);
    } else if (data.reason) {
      if (String(data.reason).includes("PIN")) {
        setLoginPinError(String(data.reason));
      } else {
        showPhoneError(String(data.reason));
      }
    }
  }

  async function importCsv(file: File) {
    setImportFileError(null);
    setImportResult(null);
    setImporting(true);
    try {
      const csv = await file.text();
      const { valid, errors } = parseRiderCsvClient(csv);
      if (valid.length === 0 && errors.length > 0) {
        setImportFileError(errors[0]?.reason ?? "Failed to import this file.");
        setImporting(false);
        return;
      }
      const res = await apiFetch(bulkImportEndpoint, {
        method: "POST",
        body: JSON.stringify({
          riders: valid,
          ...(createBranchId ? { branch_id: createBranchId } : {}),
        }),
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
      setImportResult({
        imported: data.imported ?? data.riders?.length ?? 0,
        errors: [
          ...errors,
          ...(data.errors ?? []).map((e: { index?: number; reason: string }) => ({
            line: (e.index ?? 0) + 2,
            reason: e.reason,
          })),
        ],
      });
    } catch {
      setImportFileError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function renderEditForm() {
    return (
      <div className="space-y-2">
        <PanelInput placeholder="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
        <div>
          <PanelInput
            placeholder="Phone (e.g. 03XXXXXXXXX)"
            value={editPhone}
            onChange={(e) => {
              setEditPhone(e.target.value);
              if (editPhoneError) setEditPhoneError(null);
            }}
            className={editPhoneError ? "border-status-danger" : ""}
          />
          {editPhoneError && (
            <p className="mt-1 text-sm text-status-danger" role="alert">
              {editPhoneError}
            </p>
          )}
        </div>
        <PanelInput
          placeholder="License plate (e.g. ABC-123)"
          value={editPlate}
          onChange={(e) => setEditPlate(e.target.value)}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={saveEdit} disabled={editSaving || !editName.trim() || !editPhone}>
            {editSaving && <Spinner className="h-4 w-4" />}
            Save
          </Button>
          <Button variant="accent-outline" size="sm" onClick={() => setEditingId(null)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  function renderEditDeactivateButtons(r: Rider) {
    if (isLight) {
      return (
        <>
          <MerchantButton variant="secondary" size="sm" onClick={() => startEdit(r)}>
            Edit
          </MerchantButton>
          <MerchantButton
            variant="danger"
            size="sm"
            onClick={() => toggleActive(r)}
            disabled={togglingId === r.id}
          >
            {togglingId === r.id ? <Spinner className="h-4 w-4" /> : r.active ? "Deactivate" : "Activate"}
          </MerchantButton>
        </>
      );
    }
    return (
      <>
        <Button variant="accent-outline" size="sm" onClick={() => startEdit(r)}>
          Edit
        </Button>
        <Button variant="accent-outline" size="sm" onClick={() => toggleActive(r)} disabled={togglingId === r.id}>
          {togglingId === r.id ? <Spinner className="h-4 w-4" /> : r.active ? "Deactivate" : "Activate"}
        </Button>
      </>
    );
  }

  const filteredRiders = riders.filter((r) => {
    if (branchFilter !== "all" && r.branch_id !== branchFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const haystack = [r.name, r.phone, r.license_plate ?? ""].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const branchNameById = new Map(branches.map((b) => [b.id, `${b.name} (${b.code})`]));
  const activeBranches = branches.filter((b) => b.active);

  const mapOpen = mapMode.kind !== "closed";

  return (
    <div
      className={
        !isLight && !isSplit && mapMode.kind !== "closed"
          ? "w-screen max-w-none space-y-6 px-6 ml-[calc(50%_-_50vw)]"
          : "space-y-6"
      }
    >
      <div className="flex w-full flex-wrap items-center justify-end gap-2">
        {branches.length > 0 ? (
          isLight ? (
            <MerchantSelect
              className="mr-auto max-w-xs"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="all">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code}){!b.active ? " — inactive" : ""}
                </option>
              ))}
            </MerchantSelect>
          ) : (
            <select
              className="mr-auto max-w-xs rounded-lg border border-white/10 bg-brand-navy px-3 py-2 text-sm text-white"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="all">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          )
        ) : null}
        {isLight ? (
          <>
            <MerchantButton
              variant="secondary"
              onClick={() => setMapMode((m) => (m.kind === "all" ? { kind: "closed" } : { kind: "all" }))}
            >
              {mapMode.kind === "all" ? "Hide Map" : "Show Map"}
            </MerchantButton>
            <MerchantButton
              variant="secondary"
              onClick={() => {
                setShowBulkImport((v) => !v);
                setShowAddForm(false);
              }}
            >
              {showBulkImport ? "Cancel" : "Import CSV"}
            </MerchantButton>
            <MerchantButton
              onClick={() => {
                setShowAddForm((v) => !v);
                setShowBulkImport(false);
              }}
            >
              {showAddForm ? "Cancel" : "+ Add Rider"}
            </MerchantButton>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {showBulkImport && (
        <PanelCard title="Bulk Import Riders" className="animate-slide-up">
          <p className={`mb-3 text-sm ${isLight ? "text-slate-500" : "text-white/50"}`}>
            A CSV file with columns <code className={isLight ? "text-slate-700" : "text-white/70"}>name</code>,{" "}
            <code className={isLight ? "text-slate-700" : "text-white/70"}>phone</code>,{" "}
            <code className={isLight ? "text-slate-700" : "text-white/70"}>license_plate</code>, and{" "}
            <code className={isLight ? "text-slate-700" : "text-white/70"}>login_pin</code> (any column order, header row
            required).
          </p>
          {activeBranches.length > 0 ? (
            <div className="mb-3">
              <label className={`mb-1 block text-xs font-medium ${isLight ? "text-slate-600" : "text-white/60"}`}>
                Import into branch
              </label>
              {isLight ? (
                <MerchantSelect
                  value={createBranchId}
                  onChange={(e) => setCreateBranchId(e.target.value)}
                >
                  {activeBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </MerchantSelect>
              ) : (
                <select
                  className="w-full rounded-lg border border-white/10 bg-brand-navy px-3 py-2 text-sm text-white"
                  value={createBranchId}
                  onChange={(e) => setCreateBranchId(e.target.value)}
                >
                  {activeBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}
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
                <div
                  className={`max-h-48 overflow-y-auto rounded-lg border p-3 ${
                    isLight ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/5"
                  }`}
                >
                  {importResult.errors.map((e, i) => (
                    <p key={i} className={`text-xs ${isLight ? "text-slate-600" : "text-white/60"}`}>
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
            className={`block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-2 file:text-sm file:font-medium ${
              isLight
                ? "text-slate-600 file:bg-[var(--merchant-primary,#1e3a5f)] file:text-white"
                : "text-white/70 file:bg-brand-gold file:text-brand-navy"
            }`}
          />
          {importing && (
            <p className={`mt-2 flex items-center gap-2 text-sm ${isLight ? "text-slate-500" : "text-white/50"}`}>
              <Spinner className="h-4 w-4" /> Importing…
            </p>
          )}
        </PanelCard>
      )}

      {showAddForm && (
        <PanelCard title="Add Rider" className="animate-slide-up">
          <div className="space-y-3">
            {activeBranches.length > 0 ? (
              isLight ? (
                <MerchantSelect
                  value={createBranchId}
                  onChange={(e) => setCreateBranchId(e.target.value)}
                >
                  {activeBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </MerchantSelect>
              ) : (
                <select
                  className="w-full rounded-lg border border-white/10 bg-brand-navy px-3 py-2 text-sm text-white"
                  value={createBranchId}
                  onChange={(e) => setCreateBranchId(e.target.value)}
                >
                  {activeBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              )
            ) : null}
            <PanelInput placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <div>
              <PanelInput
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
            <PanelInput
              placeholder="License plate (e.g. ABC-123)"
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value)}
            />
            <div>
              <PanelInput
                placeholder="App login PIN (6 digits)"
                value={loginPin}
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => {
                  setLoginPin(e.target.value.replace(/\D/g, "").slice(0, 6));
                  if (loginPinError) setLoginPinError(null);
                }}
                className={loginPinError ? "border-status-danger" : ""}
              />
              {loginPinError && (
                <p className="mt-1 text-sm text-status-danger" role="alert">
                  {loginPinError}
                </p>
              )}
            </div>
            {isLight ? (
              <MerchantButton
                onClick={addRider}
                disabled={submitting || !name || !phone || !licensePlate.trim() || loginPin.length !== 6}
              >
                {submitting && <Spinner className="h-4 w-4" />}
                Add Rider
              </MerchantButton>
            ) : (
              <Button
                onClick={addRider}
                disabled={submitting || !name || !phone || !licensePlate.trim() || loginPin.length !== 6}
              >
                {submitting && <Spinner className="h-4 w-4" />}
                Add Rider
              </Button>
            )}
          </div>
        </PanelCard>
      )}

      <div
        className={
          mapOpen
            ? isLight
              ? "grid h-[calc(100vh-260px)] min-h-[520px] grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,360px)_1fr]"
              : "flex h-[calc(100vh-280px)] min-h-[480px] gap-4"
            : ""
        }
      >
        <div
          className={`min-w-0 space-y-4 transition-all duration-300 ${
            mapOpen
              ? isLight
                ? "overflow-y-auto pr-1"
                : "w-full max-w-sm shrink-0 overflow-y-auto pr-1 lg:max-w-md"
              : "max-w-full"
          }`}
        >
          {isLight ? (
            <MerchantInput
              placeholder="Search riders by name, phone, or plate…"
              value={globalSearch.trim() ? globalSearch : localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              disabled={Boolean(globalSearch.trim())}
            />
          ) : null}

          {mapMode.kind === "single" && selectedRider ? (
            <div
              className={`animate-fade-in space-y-4 rounded-xl border p-4 ${
                isLight ? "border-slate-200 bg-slate-50" : "border-brand-gold bg-brand-gold/10"
              }`}
            >
              {isLight ? (
                <MerchantButton variant="secondary" size="sm" onClick={() => setMapMode({ kind: "all" })}>
                  ← Back to all riders
                </MerchantButton>
              ) : (
                <Button variant="accent-outline" size="sm" onClick={() => setMapMode({ kind: "all" })}>
                  ← Back to all riders
                </Button>
              )}
              {editingId === selectedRider.id ? (
                renderEditForm()
              ) : (
                <>
                  <RiderInfo
                    r={selectedRider}
                    light={isLight}
                    branchLabel={
                      selectedRider.branch_id
                        ? branchNameById.get(selectedRider.branch_id) ?? null
                        : null
                    }
                  />
                  <RiderBadges r={selectedRider} light={isLight} />
                  <div className="flex flex-wrap gap-2">
                    {selectedRider.availability_token &&
                      (isLight ? (
                        <MerchantButton
                          variant="secondary"
                          size="sm"
                          onClick={() => copyAvailabilityLink(selectedRider)}
                        >
                          {copiedId === selectedRider.id ? "Copied!" : "Copy Link"}
                        </MerchantButton>
                      ) : (
                        <Button variant="accent-outline" size="sm" onClick={() => copyAvailabilityLink(selectedRider)}>
                          {copiedId === selectedRider.id ? "Copied!" : "Copy Link"}
                        </Button>
                      ))}
                    {renderEditDeactivateButtons(selectedRider)}
                  </div>
                </>
              )}
            </div>
          ) : filteredRiders.length === 0 ? (
            <div
              className={`rounded-xl border border-dashed p-8 text-center ${
                isLight ? "border-slate-200 text-slate-500" : "border-white/15 text-white/50"
              }`}
            >
              {riders.length === 0
                ? "No riders yet."
                : searchQuery.trim()
                  ? "No riders match your search."
                  : "No riders yet."}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRiders.map((r) => (
                <div
                  key={r.id}
                  className={`animate-fade-in space-y-3 rounded-xl border p-4 transition-colors ${
                    isLight
                      ? "border-slate-200 bg-white hover:bg-slate-50"
                      : "border-white/10 bg-surface-raised hover:bg-white/5"
                  }`}
                >
                  {editingId === r.id ? (
                    renderEditForm()
                  ) : (
                    <>
                      <RiderInfo
                        r={r}
                        light={isLight}
                        branchLabel={r.branch_id ? branchNameById.get(r.branch_id) ?? null : null}
                      />
                      <RiderBadges r={r} light={isLight} />
                      <div className="flex flex-wrap gap-2">
                        {r.availability_token &&
                          (isLight ? (
                            <MerchantButton variant="secondary" size="sm" onClick={() => copyAvailabilityLink(r)}>
                              {copiedId === r.id ? "Copied!" : "Copy Link"}
                            </MerchantButton>
                          ) : (
                            <Button variant="accent-outline" size="sm" onClick={() => copyAvailabilityLink(r)}>
                              {copiedId === r.id ? "Copied!" : "Copy Link"}
                            </Button>
                          ))}
                        {isLight ? (
                          <MerchantButton
                            variant="primary"
                            size="sm"
                            onClick={() => setMapMode({ kind: "single", riderId: r.id })}
                          >
                            Track Location
                          </MerchantButton>
                        ) : (
                          <Button
                            variant="accent-outline"
                            size="sm"
                            onClick={() => setMapMode({ kind: "single", riderId: r.id })}
                          >
                            Track Location
                          </Button>
                        )}
                        {renderEditDeactivateButtons(r)}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          {mapMode.kind !== "single" && (
            <p className={`text-xs ${isLight ? "text-slate-500" : "text-white/40"}`}>
              {filteredRiders.length} of {riders.length} riders
            </p>
          )}
        </div>

        {mapOpen && (
          <div className={`min-h-0 min-w-0 animate-fade-in ${isLight ? "h-full" : "flex h-full flex-1"}`}>
            {mapMode.kind === "all" ? (
              <AllRidersMapPanel
                riders={riders.map((r) => ({ id: r.id, name: r.name }))}
                endpointBase={locationEndpointBase}
                onClose={() => setMapMode({ kind: "closed" })}
                onSelectRider={(riderId) => setMapMode({ kind: "single", riderId })}
                variant={isLight ? "light" : "dark"}
              />
            ) : selectedRider ? (
              <RiderLocationPanel
                key={selectedRider.id}
                riderId={selectedRider.id}
                riderName={selectedRider.name}
                endpointBase={locationEndpointBase}
                onClose={() => setMapMode(mapOpen && mapMode.kind === "single" ? { kind: "all" } : { kind: "closed" })}
                variant={isLight ? "light" : "dark"}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
