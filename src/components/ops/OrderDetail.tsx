"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";

type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  status: string;
  assigned_rider_id: string | null;
  tracking_expired_unresolved: boolean;
  delivery_confirmed_by: string | null;
  review_flag_reason: string | null;
  rider_arrived_at: string | null;
  created_at: string;
  delivered_at: string | null;
};
type TokenRow = {
  id: string;
  token: string;
  type: "rider" | "customer";
  active: boolean;
  expires_at: string | null;
  revoked_reason: string | null;
  created_at: string;
};
type Rider = { id: string; name: string; phone: string };

const statusPillClasses: Record<string, string> = {
  pending: "bg-brand-navy/10 text-brand-navy",
  assigned: "bg-status-warning/10 text-status-warning",
  in_transit: "bg-status-warning/10 text-status-warning",
  arrived: "bg-status-warning/10 text-status-warning",
  pending_confirmation: "bg-status-warning/10 text-status-warning",
  delivered: "bg-status-success/10 text-status-success",
  cancelled: "bg-status-danger/10 text-status-danger",
  flagged_review: "bg-status-danger/10 text-status-danger",
};

const flagReasonLabels: Record<string, string> = {
  far_from_address: "Rider was too far from the delivery address when marking complete.",
  customer_rejected: "Customer said they did not receive the order.",
};

export function OrderDetail({
  order,
  tokens,
  riders,
}: {
  order: Order;
  tokens: TokenRow[];
  riders: Rider[];
}) {
  const router = useRouter();
  const [selectedRider, setSelectedRider] = useState(riders[0]?.id ?? "");
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const activeRiderToken = tokens.find((t) => t.type === "rider" && t.active);
  const activeCustomerToken = tokens.find((t) => t.type === "customer" && t.active);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function assign(confirmReassign = false) {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/ops/orders/${order.id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riderId: selectedRider, confirmReassign }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.status === "needs_confirmation") {
      setNeedsConfirm(true);
      return;
    }
    setNeedsConfirm(false);
    if (data.status === "ok") {
      setMessage(
        data.pin
          ? `Rider assigned. Test-mode PIN (no real SMS provider connected yet): ${data.pin}`
          : "Rider assigned. Links sent."
      );
      router.refresh();
    } else {
      setMessage(`Failed: ${data.status}`);
    }
  }

  async function resetSession() {
    setBusy(true);
    const res = await fetch(`/api/ops/orders/${order.id}/reset-session`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    setMessage(data.status === "ok" ? "Session reset. Rider must re-enter PIN on new device." : `Failed: ${data.status}`);
  }

  async function cancelOrder() {
    setBusy(true);
    const res = await fetch(`/api/ops/orders/${order.id}/cancel`, { method: "POST" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="max-w-2xl animate-slide-up space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-brand-navy">{order.customer_name}</h1>
          <span
            className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusPillClasses[order.status] ?? "bg-brand-navy/10 text-brand-navy"}`}
          >
            {order.status.replace("_", " ")}
          </span>
        </div>
        <p className="mt-1 text-sm text-brand-navy/70">{order.delivery_address}</p>
        <div className="mt-3 space-y-2">
          {order.tracking_expired_unresolved && (
            <StatusBanner tone="warning">Tracking link expired on this still-open order.</StatusBanner>
          )}
          {order.delivery_confirmed_by === "auto_location" && (
            <StatusBanner tone="success">Auto-confirmed by sustained proximity to delivery address.</StatusBanner>
          )}
          {order.delivery_confirmed_by === "customer_timeout" && (
            <StatusBanner tone="warning">
              Auto-confirmed after 30 minutes with no customer response (not a genuine confirmation).
            </StatusBanner>
          )}
          {order.status === "flagged_review" && order.review_flag_reason && (
            <StatusBanner tone="danger">
              {flagReasonLabels[order.review_flag_reason] ?? order.review_flag_reason}
            </StatusBanner>
          )}
          {order.status === "pending_confirmation" && (
            <StatusBanner tone="warning">
              Rider marked this complete near the delivery address — waiting on the customer to
              confirm Yes/No (auto-resolves as delivered after 30 minutes with no response).
            </StatusBanner>
          )}
        </div>
      </div>

      {message && <StatusBanner tone="success">{message}</StatusBanner>}

      {order.status !== "delivered" &&
        order.status !== "cancelled" &&
        order.status !== "pending_confirmation" &&
        order.status !== "flagged_review" && (
        <Card title="Assign Rider">
          <div className="flex gap-2">
            <Select
              className="flex-1"
              value={selectedRider}
              onChange={(e) => setSelectedRider(e.target.value)}
            >
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.phone}
                </option>
              ))}
            </Select>
            <Button onClick={() => assign(false)} disabled={busy || !selectedRider}>
              {busy && <Spinner className="h-4 w-4" />}
              {order.assigned_rider_id ? "Reassign" : "Assign"}
            </Button>
          </div>
          {needsConfirm && (
            <div className="mt-3 animate-scale-in space-y-2">
              <StatusBanner tone="warning">
                This order already has an active rider. Confirm to reassign — the current
                rider&apos;s link will be revoked immediately.
              </StatusBanner>
              <Button onClick={() => assign(true)} disabled={busy}>
                Confirm Reassignment
              </Button>
            </div>
          )}
        </Card>
      )}

      {(activeRiderToken || activeCustomerToken) && (
        <Card title="Active Links" className="animate-fade-in">
          <div className="space-y-3">
            {activeRiderToken && (
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm text-brand-navy/80">
                  Rider: {origin}/rider/{activeRiderToken.token}
                </p>
                <a href={`/rider/${activeRiderToken.token}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="accent-outline" size="sm" className="w-40 shrink-0">
                    Open Rider Link
                  </Button>
                </a>
              </div>
            )}
            {activeCustomerToken && (
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm text-brand-navy/80">
                  Customer: {origin}/customer/{activeCustomerToken.token}
                </p>
                <a href={`/customer/${activeCustomerToken.token}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="accent-outline" size="sm" className="w-40 shrink-0">
                    Open Customer Link
                  </Button>
                </a>
              </div>
            )}
          </div>
        </Card>
      )}

      {activeRiderToken && (
        <Card title="Device Swap" className="animate-fade-in">
          <p className="mb-3 text-sm text-brand-navy/70">
            If the rider&apos;s phone died or was swapped, reset the tracking session so the new
            device can verify the PIN.
          </p>
          <Button variant="accent-outline" onClick={resetSession} disabled={busy}>
            Reset Tracking Session
          </Button>
        </Card>
      )}

      {order.status !== "delivered" && order.status !== "cancelled" && (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/5 p-5">
          <h2 className="mb-3 font-semibold text-status-danger">Cancel Order</h2>
          <button
            onClick={cancelOrder}
            disabled={busy}
            className="rounded-xl border-2 border-status-danger px-5 py-3 font-semibold text-status-danger transition-all duration-150 hover:bg-status-danger/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel Order
          </button>
        </div>
      )}
    </div>
  );
}
