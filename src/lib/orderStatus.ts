// Shared order-status presentation used by the Dashboard, Orders list, and
// Order detail page -- purely display labels/colors, no relation to the
// actual status values themselves (still exactly the same strings the
// `orders.status` check constraint already allows).
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_transit: "In Transit",
  arrived: "Arrived",
  pending_confirmation: "Pending Confirmation",
  delivered: "Delivered",
  cancelled: "Cancelled",
  flagged_review: "Flagged Review",
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export const ORDER_STATUS_BADGE_CLASSES: Record<string, string> = {
  pending: "bg-white/10 text-white/70",
  assigned: "bg-blue-500/15 text-blue-400",
  in_transit: "bg-amber-500/15 text-amber-400",
  arrived: "bg-teal-500/15 text-teal-400",
  pending_confirmation: "bg-amber-500/15 text-amber-400",
  delivered: "bg-status-success/15 text-status-success",
  cancelled: "bg-status-danger/15 text-status-danger",
  flagged_review: "bg-status-danger/15 text-status-danger",
};

export function orderStatusBadgeClasses(status: string): string {
  return ORDER_STATUS_BADGE_CLASSES[status] ?? "bg-white/10 text-white/70";
}

// Filter tabs on the Orders list -- "all" isn't a real status value, just
// the unfiltered view.
export const ORDER_STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "assigned", label: "Assigned" },
  { value: "in_transit", label: "In Transit" },
  { value: "arrived", label: "Arrived" },
  { value: "delivered", label: "Delivered" },
  { value: "flagged_review", label: "Flagged Review" },
];
