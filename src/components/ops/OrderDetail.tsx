"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";

type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  status: string;
  assigned_rider_id: string | null;
  tracking_expired_unresolved: boolean;
  delivery_confirmed_by: string | null;
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
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-brand-navy">{order.customer_name}</h1>
        <p className="text-sm text-brand-navy/70">{order.delivery_address}</p>
        <p className="mt-1 text-sm capitalize text-brand-navy">Status: {order.status.replace("_", " ")}</p>
        {order.tracking_expired_unresolved && (
          <StatusBanner tone="warning">Tracking link expired on this still-open order.</StatusBanner>
        )}
        {order.delivery_confirmed_by === "auto_location" && (
          <StatusBanner tone="success">Auto-confirmed by sustained proximity to delivery address.</StatusBanner>
        )}
      </div>

      {message && <StatusBanner tone="success">{message}</StatusBanner>}

      {order.status !== "delivered" && order.status !== "cancelled" && (
        <div className="rounded-lg border border-brand-navy/10 p-4">
          <h2 className="mb-2 font-semibold text-brand-navy">Assign Rider</h2>
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-lg border border-brand-navy/30 px-3 py-2"
              value={selectedRider}
              onChange={(e) => setSelectedRider(e.target.value)}
            >
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.phone}
                </option>
              ))}
            </select>
            <Button onClick={() => assign(false)} disabled={busy || !selectedRider}>
              {order.assigned_rider_id ? "Reassign" : "Assign"}
            </Button>
          </div>
          {needsConfirm && (
            <div className="mt-3">
              <StatusBanner tone="warning">
                This order already has an active rider. Confirm to reassign — the current
                rider&apos;s link will be revoked immediately.
              </StatusBanner>
              <Button className="mt-2" onClick={() => assign(true)} disabled={busy}>
                Confirm Reassignment
              </Button>
            </div>
          )}
        </div>
      )}

      {(activeRiderToken || activeCustomerToken) && (
        <div className="rounded-lg border border-brand-navy/10 p-4">
          <h2 className="mb-2 font-semibold text-brand-navy">Active Links</h2>
          {activeRiderToken && (
            <p className="break-all text-sm">
              Rider: {origin}/rider/{activeRiderToken.token}
            </p>
          )}
          {activeCustomerToken && (
            <p className="break-all text-sm">
              Customer: {origin}/customer/{activeCustomerToken.token}
            </p>
          )}
        </div>
      )}

      {activeRiderToken && (
        <div className="rounded-lg border border-brand-navy/10 p-4">
          <h2 className="mb-2 font-semibold text-brand-navy">Device Swap</h2>
          <p className="mb-2 text-sm text-brand-navy/70">
            If the rider&apos;s phone died or was swapped, reset the tracking session so the new
            device can verify the PIN.
          </p>
          <Button variant="accent-outline" onClick={resetSession} disabled={busy}>
            Reset Tracking Session
          </Button>
        </div>
      )}

      {order.status !== "delivered" && order.status !== "cancelled" && (
        <div className="rounded-lg border border-status-danger/30 p-4">
          <h2 className="mb-2 font-semibold text-status-danger">Cancel Order</h2>
          <button
            onClick={cancelOrder}
            disabled={busy}
            className="rounded-xl border-2 border-status-danger px-5 py-3 font-semibold text-status-danger"
          >
            Cancel Order
          </button>
        </div>
      )}
    </div>
  );
}
