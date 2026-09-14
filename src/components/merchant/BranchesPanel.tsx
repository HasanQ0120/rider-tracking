"use client";

import { useRef, useState } from "react";
import {
  MerchantButton,
  MerchantCard,
  MerchantInput,
} from "@/components/merchant/MerchantUi";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { apiFetch } from "@/lib/api/browserFetch";
import {
  BRANCH_CSV_TEMPLATE,
  parseBranchCsvClient,
  type ParsedBranchClient,
} from "@/lib/branchCsvClient";

export type BranchRow = {
  id: string;
  name: string;
  code: string;
  external_branch_id: string | null;
  pickup_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  active: boolean;
  created_at: string;
};

type BulkResult = {
  created: number;
  updated: number;
  errors: { index?: number; line?: number; reason: string }[];
};

function emptyForm(): ParsedBranchClient {
  return {
    name: "",
    code: "",
    external_branch_id: null,
    pickup_address: null,
    pickup_lat: null,
    pickup_lng: null,
    active: true,
  };
}

export function BranchesPanel({
  initialBranches,
  listEndpoint = "/api/merchant/branches",
  bulkEndpoint = "/api/merchant/branches/bulk",
}: {
  initialBranches: BranchRow[];
  listEndpoint?: string;
  bulkEndpoint?: string;
}) {
  const [branches, setBranches] = useState(initialBranches);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<BulkResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const res = await apiFetch(listEndpoint);
    const data = await res.json();
    if (data.branches) setBranches(data.branches);
  }

  async function createBranch() {
    setError(null);
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    const res = await apiFetch(listEndpoint, {
      method: "POST",
      body: JSON.stringify({
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        external_branch_id: form.external_branch_id,
        pickup_address: form.pickup_address,
        pickup_lat: form.pickup_lat,
        pickup_lng: form.pickup_lng,
        active: form.active,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.branch) {
      setBranches((prev) => [data.branch, ...prev]);
      setForm(emptyForm());
      setShowAdd(false);
    } else {
      setError(data.message ?? data.status ?? "Could not create branch.");
    }
  }

  function startEdit(b: BranchRow) {
    setEditingId(b.id);
    setEditForm({
      name: b.name,
      code: b.code,
      external_branch_id: b.external_branch_id,
      pickup_address: b.pickup_address,
      pickup_lat: b.pickup_lat,
      pickup_lng: b.pickup_lng,
      active: b.active,
    });
    setError(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    setSubmitting(true);
    setError(null);
    const res = await apiFetch(`${listEndpoint}/${editingId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: editForm.name.trim(),
        code: editForm.code.trim(),
        external_branch_id: editForm.external_branch_id,
        pickup_address: editForm.pickup_address,
        pickup_lat: editForm.pickup_lat,
        pickup_lng: editForm.pickup_lng,
        active: editForm.active,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.branch) {
      setBranches((prev) => prev.map((b) => (b.id === editingId ? data.branch : b)));
      setEditingId(null);
    } else {
      setError(data.message ?? data.status ?? "Could not update branch.");
    }
  }

  async function deactivate(b: BranchRow) {
    setBusyId(b.id);
    setError(null);
    const res = await apiFetch(`${listEndpoint}/${b.id}`, { method: "DELETE" });
    const data = await res.json();
    setBusyId(null);
    if (data.branch) {
      setBranches((prev) => prev.map((x) => (x.id === b.id ? data.branch : x)));
    } else {
      setError(data.message ?? data.status ?? "Could not deactivate branch.");
    }
  }

  async function copyId(id: string) {
    await navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
  }

  function downloadTemplate() {
    const blob = new Blob([BRANCH_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "branches-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onCsvFile(file: File) {
    setImportResult(null);
    setError(null);
    const text = await file.text();
    const { valid, errors } = parseBranchCsvClient(text);
    if (valid.length === 0) {
      setImportResult({ created: 0, updated: 0, errors });
      return;
    }
    setImporting(true);
    const res = await apiFetch(bulkEndpoint, {
      method: "POST",
      body: JSON.stringify({ branches: valid }),
    });
    const data = await res.json();
    setImporting(false);
    setImportResult({
      created: data.created ?? 0,
      updated: data.updated ?? 0,
      errors: [...errors, ...(data.errors ?? [])],
    });
    await refresh();
  }

  const activeCount = branches.filter((b) => b.active).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {branches.length} branch{branches.length === 1 ? "" : "es"} · {activeCount} active
        </p>
        <div className="flex flex-wrap gap-2">
          <MerchantButton type="button" variant="secondary" onClick={downloadTemplate}>
            Download CSV template
          </MerchantButton>
          <MerchantButton
            type="button"
            variant="secondary"
            onClick={() => {
              setShowBulk((v) => !v);
              setShowAdd(false);
            }}
          >
            {showBulk ? "Close import" : "Upload CSV"}
          </MerchantButton>
          <MerchantButton
            type="button"
            onClick={() => {
              setShowAdd((v) => !v);
              setShowBulk(false);
              setError(null);
            }}
          >
            {showAdd ? "Cancel" : "Add branch"}
          </MerchantButton>
        </div>
      </div>

      {error ? <StatusBanner tone="danger">{error}</StatusBanner> : null}

      {showAdd ? (
        <MerchantCard className="space-y-4 p-5">
          <h3 className="text-sm font-semibold text-slate-900">New branch</h3>
          <BranchFormFields form={form} setForm={setForm} />
          <MerchantButton type="button" onClick={createBranch} disabled={submitting}>
            {submitting ? <Spinner className="h-4 w-4" /> : null}
            {submitting ? "Creating…" : "Create branch"}
          </MerchantButton>
        </MerchantCard>
      ) : null}

      {showBulk ? (
        <MerchantCard className="space-y-4 p-5">
          <h3 className="text-sm font-semibold text-slate-900">Import branches CSV</h3>
          <p className="text-sm text-slate-600">
            Columns: name, code, external_branch_id, pickup_address, pickup_lat, pickup_lng.
            Existing rows upsert by code (or external_branch_id).
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm text-slate-600"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onCsvFile(f);
              e.target.value = "";
            }}
          />
          {importing ? (
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <Spinner className="h-4 w-4" /> Importing…
            </p>
          ) : null}
          {importResult ? (
            <div className="space-y-2 text-sm">
              <p className="text-slate-700">
                Created {importResult.created}, updated {importResult.updated}
                {importResult.errors.length ? `, ${importResult.errors.length} row error(s)` : ""}
              </p>
              {importResult.errors.length > 0 ? (
                <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-red-600">
                  {importResult.errors.map((e, i) => (
                    <li key={i}>
                      {e.line != null ? `Line ${e.line}` : e.index != null ? `Row ${e.index}` : "Row"}
                      : {e.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </MerchantCard>
      ) : null}

      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {branches.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No branches yet.</p>
        ) : (
          branches.map((b) => (
            <div key={b.id} className="p-4 sm:p-5">
              {editingId === b.id ? (
                <div className="space-y-4">
                  <BranchFormFields form={editForm} setForm={setEditForm} codeLocked={b.code === "main"} />
                  <div className="flex gap-2">
                    <MerchantButton type="button" onClick={saveEdit} disabled={submitting}>
                      {submitting ? "Saving…" : "Save"}
                    </MerchantButton>
                    <MerchantButton
                      type="button"
                      variant="secondary"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </MerchantButton>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{b.name}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                        {b.code}
                      </span>
                      {!b.active ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                          Inactive
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {b.pickup_address ?? "No pickup address"}
                      {b.pickup_lat != null && b.pickup_lng != null
                        ? ` · ${b.pickup_lat.toFixed(4)}, ${b.pickup_lng.toFixed(4)}`
                        : ""}
                    </p>
                    {b.external_branch_id ? (
                      <p className="mt-0.5 font-mono text-xs text-slate-400">
                        external: {b.external_branch_id}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void copyId(b.id)}
                      className="mt-2 font-mono text-xs text-slate-500 underline-offset-2 hover:underline"
                    >
                      {copiedId === b.id ? "Copied branch_id" : `id: ${b.id.slice(0, 8)}…`}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <MerchantButton type="button" variant="secondary" onClick={() => startEdit(b)}>
                      Edit
                    </MerchantButton>
                    {b.active ? (
                      <MerchantButton
                        type="button"
                        variant="secondary"
                        disabled={busyId === b.id}
                        onClick={() => void deactivate(b)}
                      >
                        {busyId === b.id ? "…" : "Deactivate"}
                      </MerchantButton>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function BranchFormFields({
  form,
  setForm,
  codeLocked = false,
}: {
  form: ParsedBranchClient;
  setForm: (f: ParsedBranchClient) => void;
  codeLocked?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium text-slate-700">Name</span>
        <MerchantInput
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="DHA Phase 5"
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium text-slate-700">Code</span>
        <MerchantInput
          value={form.code}
          disabled={codeLocked}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          placeholder="dha-5 (optional)"
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium text-slate-700">External branch ID</span>
        <MerchantInput
          value={form.external_branch_id ?? ""}
          onChange={(e) =>
            setForm({ ...form, external_branch_id: e.target.value.trim() || null })
          }
          placeholder="GL-OUT-101"
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium text-slate-700">Pickup address</span>
        <MerchantInput
          value={form.pickup_address ?? ""}
          onChange={(e) =>
            setForm({ ...form, pickup_address: e.target.value.trim() || null })
          }
          placeholder="Street, city"
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium text-slate-700">Pickup lat</span>
        <MerchantInput
          type="number"
          step="any"
          value={form.pickup_lat ?? ""}
          onChange={(e) =>
            setForm({
              ...form,
              pickup_lat: e.target.value === "" ? null : Number(e.target.value),
            })
          }
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium text-slate-700">Pickup lng</span>
        <MerchantInput
          type="number"
          step="any"
          value={form.pickup_lng ?? ""}
          onChange={(e) =>
            setForm({
              ...form,
              pickup_lng: e.target.value === "" ? null : Number(e.target.value),
            })
          }
        />
      </label>
    </div>
  );
}

