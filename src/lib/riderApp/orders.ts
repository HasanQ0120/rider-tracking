import "server-only";

// Statuses shown in the rider app's "active" inbox -- deliveries still in
// the rider's hands or awaiting customer confirmation on their mark-complete.
export const RIDER_ACTIVE_STATUSES = [
  "assigned",
  "in_transit",
  "arrived",
  "pending_confirmation",
] as const;

export const RIDER_HISTORY_STATUSES = ["delivered", "cancelled", "flagged_review"] as const;

export const RIDER_ORDER_COLUMNS =
  "id, status, customer_name, customer_phone, delivery_address, address_detail, delivery_lat, delivery_lng, assigned_at, created_at, delivered_at, rider_arrived_at";

export type RiderOrderRow = {
  id: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  address_detail: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  assigned_at: string | null;
  created_at: string;
  delivered_at: string | null;
  rider_arrived_at: string | null;
};
