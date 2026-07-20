import Link from "next/link";

type OrderRow = {
  id: string;
  customer_name: string;
  delivery_address: string;
  status: string;
  tracking_expired_unresolved: boolean;
  delivery_confirmed_by: string | null;
  created_at: string;
  riders: { name: string } | { name: string }[] | null;
};

function riderName(riders: OrderRow["riders"]): string {
  if (!riders) return "Unassigned";
  return Array.isArray(riders) ? riders[0]?.name ?? "Unassigned" : riders.name;
}

export function OrdersTable({ orders }: { orders: OrderRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-brand-navy/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-brand-navy/5 text-brand-navy">
          <tr>
            <th className="px-4 py-2">Customer</th>
            <th className="px-4 py-2">Address</th>
            <th className="px-4 py-2">Rider</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Flags</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-t border-brand-navy/10">
              <td className="px-4 py-2">
                <Link href={`/ops/orders/${o.id}`} className="text-brand-navy underline">
                  {o.customer_name}
                </Link>
              </td>
              <td className="px-4 py-2">{o.delivery_address}</td>
              <td className="px-4 py-2">{riderName(o.riders)}</td>
              <td className="px-4 py-2 capitalize">{o.status.replace("_", " ")}</td>
              <td className="px-4 py-2">
                {o.tracking_expired_unresolved && (
                  <span className="rounded bg-status-warning/10 px-2 py-0.5 text-status-warning">
                    link expired
                  </span>
                )}
                {o.delivery_confirmed_by === "auto_location" && (
                  <span className="ml-1 rounded bg-status-success/10 px-2 py-0.5 text-status-success">
                    auto-confirmed
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
