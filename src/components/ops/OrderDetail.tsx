"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import {
  MerchantButton,
  MerchantCard,
  MerchantSelect,
} from "@/components/merchant/MerchantUi";
import { formatOrderCode } from "@/lib/orderCode";
import { orderStatusBadgeClasses, orderStatusLabel } from "@/lib/orderStatus";
import { apiFetch } from "@/lib/api/browserFetch";

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
  pin = null,
  assignEndpoint = `/api/ops/orders/${order.id}/assign`,
  resetSessionEndpoint = `/api/ops/orders/${order.id}/reset-session`,
  cancelEndpoint = `/api/ops/orders/${order.id}/cancel`,
  backHref = "/ops/orders",
  showCancelAction = true,
  showResetSessionAction = true,
  showRiderLinks = true,
  merchantMode = false,
}: {
  order: Order;
  orderRank: number;
  tokens: TokenRow[];
  riders: Rider[];
  // Persistent PIN read back from the DB (pin_codes.pin_plain) for the
  // order's active rider token, if any -- only ever non-null while no real
  // SMS provider is connected. Covers auto-assigned orders (which never
  // trigger the assign-response toast below at all) and surviving a reload.
  pin?: string | null;
  // Lets the merchant dashboard reuse this exact component against its own
  // tenant-scoped API routes instead of ops's -- defaults keep ops's
  // existing behavior completely unchanged. Cancel/reset-session stay
  // ops-only for now (merchant only asked for rider assignment), gated
  // off rather than pointed at endpoints that don't exist.
  assignEndpoint?: string;
  resetSessionEndpoint?: string;
  cancelEndpoint?: string;
  backHref?: string;
  showCancelAction?: boolean;
  showResetSessionAction?: boolean;
  /** SaaS merchant dashboard — customer tracking URL only, no rider web links. */
  showRiderLinks?: boolean;
  merchantMode?: boolean;
}) {
  const router = useRouter();
  const [selectedRider, setSelectedRider] = useState(
    order.assigned_rider_id ?? riders[0]?.id ?? ""
  );
  const [needsConfirm, setNeedsConfirm] = useState(false);
  // Tracks exactly which action is in flight, not just whether *something*
  // is -- so only the button actually clicked shows its own spinner while
  // the others just go inert, instead of every button spinning at once.
  const [busyAction, setBusyAction] = useState<null | "assign" | "reassign" | "reset" | "cancel">(
    null
  );
  const [message, setMessage] = useState<string | null>(null);
  // Shows the freshly-assigned PIN immediately, before the router.refresh()
  // below round-trips back with the same value via the persistent `pin`
  // prop -- falls back to that prop otherwise (a reload, or an
  // auto-assigned order this component never called assign() for at all).
  const [assignedPin, setAssignedPin] = useState<string | null>(null);
  const displayedPin = assignedPin ?? pin;
  const [copied, setCopied] = useState<"rider" | "customer" | null>(null);
  const busy = busyAction !== null;

  const activeRiderToken = tokens.find((t) => t.type === "rider" && t.active);
  const activeCustomerToken = tokens.find((t) => t.type === "customer" && t.active);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function assign(confirmReassign = false) {
    setBusyAction(confirmReassign ? "reassign" : "assign");
    setMessage(null);
    const res = await apiFetch(assignEndpoint, {
      method: "POST",
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
      if (data.pin && showRiderLinks) setAssignedPin(data.pin);
      setMessage(
        merchantMode
          ? "Rider assigned — they will see this order in the Rider app. Send the customer tracking URL below."
          : "Rider assigned. Links sent."
      );
      router.refresh();
    } else {
      setMessage(`Failed: ${data.status}`);
    }
  }

  async function resetSession() {
    setBusyAction("reset");
    const res = await apiFetch(resetSessionEndpoint, { method: "POST" });
    const data = await res.json();
    setBusyAction(null);
    setMessage(data.status === "ok" ? "Session reset. Rider must re-enter PIN on new device." : `Failed: ${data.status}`);
  }

  async function cancelOrder() {
    setBusyAction("cancel");
    const res = await apiFetch(cancelEndpoint, { method: "POST" });
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

  const shellCls = merchantMode
    ? "rounded-2xl border border-slate-200 bg-[#0b1220] p-6 shadow-sm md:p-8"
    : "animate-slide-up space-y-6";

  const sectionCls = merchantMode
    ? "rounded-xl border border-white/10 bg-white/[0.03] p-5"
    : "";

  const labelCls = merchantMode
    ? "text-xs uppercase tracking-wide text-white/40"
    : "text-xs uppercase tracking-wide text-slate-500";
  const valueCls = merchantMode ? "text-white" : "text-slate-900";
  const mutedCls = merchantMode ? "text-white/50" : "text-slate-500";
  const OpsCard = MerchantCard;
  const OpsButton = MerchantButton;
  const OpsSelect = MerchantSelect;

  return (
    <div className={shellCls}>
      <div className={`${merchantMode ? "mb-6" : ""} flex items-center gap-3`}>
        <Link
          href={backHref}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
            merchantMode
              ? "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
          aria-label="Back to Orders"
        >
          ←
        </Link>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1
              className={`font-mono text-xl font-semibold md:text-2xl ${
                merchantMode ? "text-white" : "text-slate-900"
              }`}
            >
              {formatOrderCode(orderRank)}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${orderStatusBadgeClasses(order.status, !merchantMode)}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {orderStatusLabel(order.status)}
            </span>
          </div>
          <p className={`text-sm ${mutedCls}`}>Created {formatTimestamp(order.created_at)}</p>
        </div>
      </div>

      <div className={merchantMode ? "mb-6 space-y-2" : "space-y-2"}>
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

      <div className={`grid grid-cols-1 gap-6 ${merchantMode ? "lg:grid-cols-[1fr_280px]" : "lg:grid-cols-3"}`}>
        <div className={`space-y-6 ${merchantMode ? "" : "lg:col-span-2"}`}>
          {merchantMode ? (
            <div className={sectionCls}>
              <h2 className="mb-4 font-semibold text-white">Customer Details</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className={labelCls}>Name</p>
                  <p className={`mt-1 ${valueCls}`}>{order.customer_name}</p>
                </div>
                <div>
                  <p className={labelCls}>Phone</p>
                  <p className={`mt-1 ${valueCls}`}>{order.customer_phone}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className={labelCls}>Delivery Address</p>
                  <p className={`mt-1 ${valueCls}`}>{order.delivery_address}</p>
                  {order.address_detail ? (
                    <p className="mt-1 text-sm text-white/60">{order.address_detail}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
          <OpsCard title="Customer Details">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className={labelCls}>Name</p>
                <p className={valueCls}>{order.customer_name}</p>
              </div>
              <div>
                <p className={labelCls}>Phone</p>
                <p className={valueCls}>{order.customer_phone}</p>
              </div>
              <div className="col-span-2">
                <p className={labelCls}>Delivery Address</p>
                <p className={valueCls}>{order.delivery_address}</p>
              </div>
              {order.address_detail && (
                <div className="col-span-2">
                  <p className={labelCls}>Plot / Floor Details</p>
                  <p className={valueCls}>{order.address_detail}</p>
                </div>
              )}
              {order.delivery_lat != null && order.delivery_lng != null && (
                <div className="col-span-2">
                  <p className={labelCls}>Coordinates</p>
                  <p className="font-mono text-sm text-[var(--merchant-primary)]">
                    {order.delivery_lat.toFixed(6)}, {order.delivery_lng.toFixed(6)}
                  </p>
                </div>
              )}
            </div>
          </OpsCard>
          )}

          {order.status !== "delivered" &&
            order.status !== "cancelled" &&
            order.status !== "pending_confirmation" &&
            order.status !== "flagged_review" &&
            (merchantMode ? (
              <div className={sectionCls}>
                <h2 className="mb-4 font-semibold text-white">Assign Rider</h2>
                <div className="flex flex-col gap-3 sm:flex-row">
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
                  <button
                    type="button"
                    onClick={() => assign(false)}
                    disabled={busy || !selectedRider}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-[#0b1220] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ backgroundColor: "var(--merchant-secondary, #ffd700)" }}
                  >
                    {busyAction === "assign" && <Spinner className="h-4 w-4" />}
                    {busyAction === "assign"
                      ? "Assigning…"
                      : order.assigned_rider_id
                        ? "Reassign"
                        : "Assign"}
                  </button>
                </div>
                {needsConfirm && (
                  <div className="mt-3 animate-scale-in space-y-2">
                    <StatusBanner tone="warning">
                      This order already has a rider assigned. Confirm to reassign — the previous
                      rider will lose access in the Rider app.
                    </StatusBanner>
                    <button
                      type="button"
                      onClick={() => assign(true)}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-[#0b1220] disabled:opacity-40"
                      style={{ backgroundColor: "var(--merchant-secondary, #ffd700)" }}
                    >
                      {busyAction === "reassign" && <Spinner className="h-4 w-4" />}
                      {busyAction === "reassign" ? "Reassigning…" : "Confirm Reassignment"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
            <OpsCard title="Assign Rider">
              <div className="flex gap-2">
                <OpsSelect
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
                </OpsSelect>
                <OpsButton onClick={() => assign(false)} disabled={busy || !selectedRider}>
                  {busyAction === "assign" && <Spinner className="h-4 w-4" />}
                  {busyAction === "assign"
                    ? "Assigning…"
                    : order.assigned_rider_id
                      ? "Reassign"
                      : "Assign"}
                </OpsButton>
              </div>
              {needsConfirm && (
                <div className="mt-3 animate-scale-in space-y-2">
                  <StatusBanner tone="warning">
                    This order already has an active rider. Confirm to reassign — the current rider&apos;s link will be revoked immediately.
                  </StatusBanner>
                  <OpsButton onClick={() => assign(true)} disabled={busy}>
                    {busyAction === "reassign" && <Spinner className="h-4 w-4" />}
                    {busyAction === "reassign" ? "Reassigning…" : "Confirm Reassignment"}
                  </OpsButton>
                </div>
              )}
            </OpsCard>
            ))}

          {((showRiderLinks && activeRiderToken) || activeCustomerToken) &&
            (merchantMode && activeCustomerToken ? (
              <div className={sectionCls}>
                <h2 className="mb-2 font-semibold text-white">Customer Tracking URL</h2>
                <p className="mb-4 text-sm text-white/60">
                  Send this link to your customer via SMS, WhatsApp, or email so they can track the
                  delivery live.
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-white/80">
                    Tracking URL{" "}
                    <span className="text-xs text-white/40">No PIN required</span>
                  </p>
                  <div className="flex gap-2">
                    <a href={`/customer/${activeCustomerToken.token}`} target="_blank" rel="noopener noreferrer">
                      <button
                        type="button"
                        className="rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/5"
                      >
                        Open
                      </button>
                    </a>
                    <button
                      type="button"
                      onClick={() => copyLink("customer", `${origin}/customer/${activeCustomerToken.token}`)}
                      className="rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/5"
                    >
                      {copied === "customer" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            ) : !merchantMode ? (
            <OpsCard
              title="Active Links"
              className="animate-fade-in"
            >
              <div className="space-y-3">
                {showRiderLinks && activeRiderToken && (
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm text-slate-600">
                        Rider Link
                        {displayedPin && (
                          <span className="ml-2 font-mono text-xs text-[var(--merchant-primary)]">
                            PIN: {displayedPin}
                          </span>
                        )}
                      </p>
                      <a href={`/rider/${activeRiderToken.token}`} target="_blank" rel="noopener noreferrer">
                        <OpsButton variant="secondary" size="sm">
                          Open
                        </OpsButton>
                      </a>
                      <OpsButton
                        variant="secondary"
                        size="sm"
                        onClick={() => copyLink("rider", `${origin}/rider/${activeRiderToken.token}`)}
                      >
                        {copied === "rider" ? "Copied!" : "Copy"}
                      </OpsButton>
                    </div>
                  </div>
                )}
                {activeCustomerToken && (
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm text-slate-600">
                      Customer Link{" "}
                      <span className="text-xs text-slate-400">No PIN required</span>
                    </p>
                    <a href={`/customer/${activeCustomerToken.token}`} target="_blank" rel="noopener noreferrer">
                      <OpsButton variant="secondary" size="sm">
                        Open
                      </OpsButton>
                    </a>
                    <OpsButton
                      variant="secondary"
                      size="sm"
                      onClick={() => copyLink("customer", `${origin}/customer/${activeCustomerToken.token}`)}
                    >
                      {copied === "customer" ? "Copied!" : "Copy"}
                    </OpsButton>
                  </div>
                )}
              </div>
            </OpsCard>
            ) : null)}

          {showResetSessionAction && activeRiderToken && (
            <OpsCard title="Device Swap" className="animate-fade-in">
              <p className="mb-3 text-sm text-slate-500">
                Resets the rider&apos;s session and generates a new PIN. Use when the rider changes
                device.
              </p>
              <OpsButton variant="secondary" onClick={resetSession} disabled={busy}>
                {busyAction === "reset" && <Spinner className="h-4 w-4" />}
                {busyAction === "reset" ? "Resetting…" : "Reset Session"}
              </OpsButton>
            </OpsCard>
          )}

          {showCancelAction && order.status !== "delivered" && order.status !== "cancelled" && (
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
          {merchantMode ? (
            <div className={`${sectionCls} h-full`}>
              <h2 className="mb-4 font-semibold text-white">Status History</h2>
              <ol className="space-y-5">
                {timeline.map((event, i) => {
                  const isCurrent = i === timeline.length - 1;
                  return (
                    <li key={`${event.label}-${event.at}`} className="flex gap-3">
                      <span className="relative mt-1 flex h-3 w-3 shrink-0 items-center justify-center">
                        {isCurrent ? (
                          <span
                            className="h-2.5 w-2.5 rotate-45"
                            style={{ backgroundColor: "var(--merchant-secondary, #ffd700)" }}
                          />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-white/25" />
                        )}
                      </span>
                      <div>
                        <p className={`text-sm font-medium ${isCurrent ? "text-white" : "text-white/70"}`}>
                          {event.label}
                        </p>
                        <p className="text-xs text-white/40">{formatTimestamp(event.at)}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
          <OpsCard title="Status History">
            <ol className="space-y-4">
              {timeline.map((event, i) => (
                <li key={`${event.label}-${event.at}`} className="flex gap-3">
                  <span
                    className={`mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full ${
                      i === timeline.length - 1
                        ? "bg-[var(--merchant-primary)]"
                        : "bg-slate-300"
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{event.label}</p>
                    <p className="text-xs text-slate-400">{formatTimestamp(event.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </OpsCard>
          )}
        </div>
      </div>
    </div>
  );
}
