// Human-readable display code (e.g. "ORD-0007") derived purely at render
// time from an order's rank by creation order -- there's no such column in
// the schema, and none is added for this. Stable in practice because
// nothing in this app ever hard-deletes an order row (cancelling just flips
// `status`), so a given order's rank never changes after creation.
export function formatOrderCode(rank: number): string {
  return `ORD-${String(rank).padStart(4, "0")}`;
}

// Builds an id -> display-code map from a list of orders sorted however the
// caller already has them, by first re-deriving creation-ascending rank.
export function buildOrderCodeMap(
  orders: { id: string; created_at: string }[]
): Map<string, string> {
  const sorted = [...orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const map = new Map<string, string>();
  sorted.forEach((order, index) => {
    map.set(order.id, formatOrderCode(index + 1));
  });
  return map;
}
