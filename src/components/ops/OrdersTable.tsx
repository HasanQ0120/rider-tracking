"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { buildOrderCodeMap } from "@/lib/orderCode";
import { ORDER_STATUS_FILTERS, orderStatusBadgeClasses, orderStatusLabel } from "@/lib/orderStatus";

type OrderRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  address_detail: string | null;
  status: string;
  tracking_expired_unresolved: boolean;
  delivery_confirmed_by: string | null;
  review_flag_reason?: string | null;
  created_at: string;
  riders: { name: string; license_plate: string | null } | { name: string; license_plate: string | null }[] | null;
};

function rider(riders: OrderRow["riders"]) {
  if (!riders) return null;
  return Array.isArray(riders) ? riders[0] ?? null : riders;
}

const flagReasonLabels: Record<string, string> = {
  far_from_address: "far from address",
  customer_rejected: "customer said not received",
};

export function OrdersTable({ orders }: { orders: OrderRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const codeMap = useMemo(() => buildOrderCodeMap(orders), [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!q) return true;
      const r = rider(o.riders);
      return (
        o.customer_name.toLowerCase().includes(q) ||
        o.delivery_address.toLowerCase().includes(q) ||
        o.customer_phone.toLowerCase().includes(q) ||
        (codeMap.get(o.id) ?? "").toLowerCase().includes(q) ||
        (r?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [orders, search, statusFilter, codeMap]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search orders, customers, addresses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {ORDER_STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-brand-gold text-brand-navy"
                  : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="animate-fade-in rounded-xl border border-dashed border-white/15 p-12 text-center text-white/50">
          {orders.length === 0 ? "No orders yet." : "No orders match your search."}
        </div>
      ) : (
        <div className="animate-fade-in overflow-x-auto rounded-xl border border-white/10 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs font-semibold uppercase tracking-wide text-white/50">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Rider</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const r = rider(o.riders);
                return (
                  <tr
                    key={o.id}
                    className={`border-t border-white/10 transition-colors hover:bg-white/5 ${
                      o.status === "flagged_review" ? "bg-status-danger/5" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/ops/orders/${o.id}`}
                        className="font-mono text-xs font-semibold text-brand-gold hover:underline"
                      >
                        {codeMap.get(o.id)}
                      </Link>
                      <p className="mt-0.5 text-xs text-white/40">
                        {new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/ops/orders/${o.id}`} className="font-medium text-white hover:underline">
                        {o.customer_name}
                      </Link>
                      <p className="text-xs text-white/50">{o.customer_phone}</p>
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      {o.delivery_address}
                      {o.address_detail && <p className="text-xs text-white/40">{o.address_detail}</p>}
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      {r ? (
                        <>
                          <p>{r.name}</p>
                          {r.license_plate && (
                            <p className="font-mono text-xs text-brand-gold/80">{r.license_plate}</p>
                          )}
                        </>
                      ) : (
                        <span className="text-white/40">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${orderStatusBadgeClasses(o.status)}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {orderStatusLabel(o.status)}
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {o.tracking_expired_unresolved && (
                          <span className="rounded-full bg-status-warning/10 px-2 py-0.5 text-xs text-status-warning">
                            link expired
                          </span>
                        )}
                        {o.delivery_confirmed_by === "auto_location" && (
                          <span className="rounded-full bg-status-success/10 px-2 py-0.5 text-xs text-status-success">
                            auto-confirmed
                          </span>
                        )}
                        {o.delivery_confirmed_by === "customer_timeout" && (
                          <span className="rounded-full bg-status-warning/10 px-2 py-0.5 text-xs text-status-warning">
                            no response — auto-confirmed
                          </span>
                        )}
                        {o.review_flag_reason && (
                          <span className="rounded-full bg-status-danger/10 px-2 py-0.5 text-xs text-status-danger">
                            {flagReasonLabels[o.review_flag_reason] ?? o.review_flag_reason}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-white/40">
        Showing {filtered.length} of {orders.length} orders
      </p>
    </div>
  );
}
