"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { formatOrderCode } from "@/lib/orderCode";
import { orderStatusBadgeClasses, orderStatusLabel } from "@/lib/orderStatus";

type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  address_detail: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  status: string;
  assigned_rider_id: string | null;
  tracking_expired_unresolved: boolean;
  delivery_confirmed_by: string | null;
  review_flag_reason: string | null;
  rider_arrived_at: string | null;
  pending_confirmation_at: string | null;
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

const flagReasonLabels: Record<string, string> = {
  far_from_address: "Rider was too far from the delivery address when marking complete.",
  customer_rejected: "Customer said they did not receive the order.",
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildTimeline(order: Order): { label: string; at: string }[] {
  const events: { label: string; at: string }[] = [{ label: "Order created", at: order.created_at }];
  // No dedicated "assigned at" timestamp exists in the schema -- if nothing
  // further along has happened yet, show the current "Assigned" status
  // anchored to the creation time, same as the mockup's single-entry
  // example for a freshly assigned order.
  if (order.assigned_rider_id && !order.rider_arrived_at && !order.delivered_at) {
    events.push({ label: "Assigned", at: order.created_at });
  }
  if (order.rider_arrived_at) events.push({ label: "Rider Arrived", at: order.rider_arrived_at });
  if (order.pending_confirmation_at) {
    events.push({ label: "Awaiting Customer Confirmation", at: order.pending_confirmation_at });
  }
  if (order.delivered_at) events.push({ label: "Delivered", at: order.delivered_at });
  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function OrderDetail({
  order,
  orderRank,
  tokens,
  riders,
}: {
  order: Order;
  orderRank: number;
  tokens: TokenRow[];
  riders: Rider[];
}) {
  const router = useRouter();
  const [selectedRider, setSelectedRider] = useState(riders[0]?.id ?? "");
  const [needsConfirm, setNeedsConfirm] = useState(false);
  // Tracks exactly which action is in flight, not just whether *something*
  // is -- so only the button actually clicked shows its own spinner while
  // the others just go inert, instead of every button spinning at once.
  const [busyAction, setBusyAction] = useState<null | "assign" | "reassign" | "reset" | "cancel">(
    null
  );
  const [message, setMessage] = useState<string | null>(null);
  // Only ever set from the assign response's own `pin` field, which the API
  // itself only includes while the notification provider is still the
  // console-log test stub -- this just gives that already-gated value a
  // more visible home (next to the rider link) instead of a one-time toast.
  const [assignedPin, setAssignedPin] = useState<string | null>(null);
  const [copied, setCopied] = useState<"rider" | "customer" | null>(null);
  const busy = busyAction !== null;

  const activeRiderToken = tokens.find((t) => t.type === "rider" && t.active);
  const activeCustomerToken = tokens.find((t) => t.type === "customer" && t.active);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function assign(confirmReassign = false) {
    setBusyAction(confirmReassign ? "reassign" : "assign");
    setMessage(null);
    const res = await fetch(`/api/ops/orders/${order.id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riderId: selectedRider, confirmReassign }),
    });
    const data = await res.json();
    setBusyAction(null);
    if (data.status === "needs_confirmation") {
      setNeedsConfirm(true);
      return;
    }
    setNeedsConfirm(false);
    if (data.status === "ok") {
      if (data.pin) setAssignedPin(data.pin);
      setMessage("Rider assigned. Links sent.");
      router.refresh();
    } else {
      setMessage(`Failed: ${data.status}`);
    }
  }

  async function resetSession() {
    setBusyAction("reset");
    const res = await fetch(`/api/ops/orders/${order.id}/reset-session`, { method: "POST" });
    const data = await res.json();
    setBusyAction(null);
    setMessage(data.status === "ok" ? "Session reset. Rider must re-enter PIN on new device." : `Failed: ${data.status}`);
  }

  async function cancelOrder() {
    setBusyAction("cancel");
    const res = await fetch(`/api/ops/orders/${order.id}/cancel`, { method: "POST" });
    if (res.ok) {
      router.refresh();
    } else {
      setBusyAction(null);
      setMessage("Failed to cancel order.");
    }
  }

  async function copyLink(kind: "rider" | "customer", url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(kind);
    setTimeout(() => setCopied((c) => (c === kind ? null : c)), 2000);
  }

  const timeline = buildTimeline(order);

  return (
    <div className="animate-slide-up space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/ops/orders"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Back to Orders"
        >
          ←
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-lg font-semibold text-white">{formatOrderCode(orderRank)}</h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${orderStatusBadgeClasses(order.status)}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {orderStatusLabel(order.status)}
            </span>
          </div>
          <p className="text-sm text-white/50">Created {formatTimestamp(order.created_at)}</p>
        </div>
      </div>

      <div className="space-y-2">
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
        {message && <StatusBanner tone="success">{message}</StatusBanner>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Customer Details">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/40">Name</p>
                <p className="text-white">{order.customer_name}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-white/40">Phone</p>
                <p className="text-white">{order.customer_phone}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs uppercase tracking-wide text-white/40">Delivery Address</p>
                <p className="text-white">{order.delivery_address}</p>
              </div>
              {order.address_detail && (
                <div className="col-span-2">
                  <p className="text-xs uppercase tracking-wide text-white/40">Plot / Floor Details</p>
                  <p className="text-white">{order.address_detail}</p>
                </div>
              )}
              {order.delivery_lat != null && order.delivery_lng != null && (
                <div className="col-span-2">
                  <p className="text-xs uppercase tracking-wide text-white/40">Coordinates</p>
                  <p className="font-mono text-sm text-brand-gold/80">
                    {order.delivery_lat.toFixed(6)}, {order.delivery_lng.toFixed(6)}
                  </p>
                </div>
              )}
            </div>
          </Card>

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
                  <option value="">Select a rider…</option>
                  {riders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {r.phone}
                    </option>
                  ))}
                </Select>
                <Button onClick={() => assign(false)} disabled={busy || !selectedRider}>
                  {busyAction === "assign" && <Spinner className="h-4 w-4" />}
                  {busyAction === "assign"
                    ? "Assigning…"
                    : order.assigned_rider_id
                      ? "Reassign"
                      : "Assign"}
                </Button>
              </div>
              {needsConfirm && (
                <div className="mt-3 animate-scale-in space-y-2">
                  <StatusBanner tone="warning">
                    This order already has an active rider. Confirm to reassign — the current
                    rider&apos;s link will be revoked immediately.
                  </StatusBanner>
                  <Button onClick={() => assign(true)} disabled={busy}>
                    {busyAction === "reassign" && <Spinner className="h-4 w-4" />}
                    {busyAction === "reassign" ? "Reassigning…" : "Confirm Reassignment"}
                  </Button>
                </div>
              )}
            </Card>
          )}

          {(activeRiderToken || activeCustomerToken) && (
            <Card title="Active Links" className="animate-fade-in">
              <div className="space-y-3">
                {activeRiderToken && (
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm text-white/70">
                        Rider Link
                        {assignedPin && (
                          <span className="ml-2 font-mono text-xs text-brand-gold">PIN: {assignedPin}</span>
                        )}
                      </p>
                      <a href={`/rider/${activeRiderToken.token}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="accent-outline" size="sm">
                          Open
                        </Button>
                      </a>
                      <Button
                        variant="accent-outline"
                        size="sm"
                        onClick={() => copyLink("rider", `${origin}/rider/${activeRiderToken.token}`)}
                      >
                        {copied === "rider" ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                  </div>
                )}
                {activeCustomerToken && (
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm text-white/70">
                      Customer Link <span className="text-xs text-white/40">No PIN required</span>
                    </p>
                    <a href={`/customer/${activeCustomerToken.token}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="accent-outline" size="sm">
                        Open
                      </Button>
                    </a>
                    <Button
                      variant="accent-outline"
                      size="sm"
                      onClick={() => copyLink("customer", `${origin}/customer/${activeCustomerToken.token}`)}
                    >
                      {copied === "customer" ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {activeRiderToken && (
            <Card title="Device Swap" className="animate-fade-in">
              <p className="mb-3 text-sm text-white/60">
                Resets the rider&apos;s session and generates a new PIN. Use when the rider changes
                device.
              </p>
              <Button variant="accent-outline" onClick={resetSession} disabled={busy}>
                {busyAction === "reset" && <Spinner className="h-4 w-4" />}
                {busyAction === "reset" ? "Resetting…" : "Reset Session"}
              </Button>
            </Card>
          )}

          {order.status !== "delivered" && order.status !== "cancelled" && (
            <div className="rounded-xl border border-status-danger/30 bg-status-danger/5 p-5">
              <h2 className="mb-3 font-semibold text-status-danger">Cancel Order</h2>
              <button
                onClick={cancelOrder}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-status-danger px-5 py-3 font-semibold text-status-danger transition-all duration-150 hover:bg-status-danger/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busyAction === "cancel" && <Spinner className="h-4 w-4" />}
                {busyAction === "cancel" ? "Cancelling…" : "Cancel Order"}
              </button>
            </div>
          )}
        </div>

        <div>
          <Card title="Status History">
            <ol className="space-y-4">
              {timeline.map((event, i) => (
                <li key={`${event.label}-${event.at}`} className="flex gap-3">
                  <span
                    className={`mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full ${
                      i === timeline.length - 1 ? "bg-brand-gold" : "bg-white/25"
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-white">{event.label}</p>
                    <p className="text-xs text-white/40">{formatTimestamp(event.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
