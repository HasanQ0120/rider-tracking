import Link from "next/link";

type OrderRow = {
  id: string;
  customer_name: string;
  delivery_address: string;
  status: string;
  tracking_expired_unresolved: boolean;
  delivery_confirmed_by: string | null;
  review_flag_reason?: string | null;
  created_at: string;
  riders: { name: string } | { name: string }[] | null;
};

function riderName(riders: OrderRow["riders"]): string {
  if (!riders) return "Unassigned";
  return Array.isArray(riders) ? riders[0]?.name ?? "Unassigned" : riders.name;
}

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
  far_from_address: "far from address",
  customer_rejected: "customer said not received",
};

export function OrdersTable({ orders }: { orders: OrderRow[] }) {
  if (orders.length === 0) {
    return (
      <div className="animate-fade-in rounded-xl border border-dashed border-brand-navy/20 p-12 text-center text-brand-navy/50">
        No orders yet.
      </div>
    );
  }

  return (
    <div className="animate-fade-in overflow-x-auto rounded-xl border border-brand-navy/10 shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-brand-navy/5 text-xs font-semibold uppercase tracking-wide text-brand-navy/60">
          <tr>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Address</th>
            <th className="px-4 py-3">Rider</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Flags</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr
              key={o.id}
              className={`border-t border-brand-navy/10 transition-colors hover:bg-brand-navy/5 ${
                o.status === "flagged_review" ? "bg-status-danger/5" : ""
              }`}
            >
              <td className="px-4 py-3">
                <Link href={`/ops/orders/${o.id}`} className="font-medium text-brand-navy hover:underline">
                  {o.customer_name}
                </Link>
              </td>
              <td className="px-4 py-3 text-brand-navy/70">{o.delivery_address}</td>
              <td className="px-4 py-3 text-brand-navy/70">{riderName(o.riders)}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusPillClasses[o.status] ?? "bg-brand-navy/10 text-brand-navy"}`}
                >
                  {o.status.replace("_", " ")}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
