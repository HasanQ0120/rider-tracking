export const MAX_ACCURACY_M = 75;
export const LOCATION_MIN_INTERVAL_MS = 3000;
export const IMPLAUSIBLE_SPEED_KMH = 150;
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCKOUT_MINUTES = 15;
export const RESEND_RATE_LIMIT_MINUTES = 2;
export const PROXIMITY_RADIUS_M = 60;
export const PROXIMITY_SUSTAIN_SECONDS = 90;
export const CONNECTION_LOST_TIMEOUT_S = 25;
export const TOKEN_TIME_BUDGET_HOURS = 4;
export const HISTORY_RETENTION_DAYS = 3;

// Map marker colors -- shared across the rider page, customer page, and the
// ops New Order preview, so all three stay in sync if this ever changes.
export const MARKER_COLOR_CUSTOMER = "#DC2626";
export const MARKER_COLOR_RIDER = "#000000";

// Throttle for OSRM route-line recalculation: only refetch when the rider
// has moved further than this since the last fetch, or enough time has
// passed. The public OSRM demo server is a best-effort, non-production
// instance (no SLA) -- recalculating on every ~5s GPS tick would be
// unnecessarily heavy for a line that barely changes tick-to-tick anyway.
export const ROUTE_REFETCH_MIN_DISTANCE_M = 40;
export const ROUTE_REFETCH_MIN_INTERVAL_MS = 15000;

// How often the customer page polls for the rider's location + order status.
// Plain polling through our own API, not a Supabase Realtime subscription --
// see /api/customer/[token]/poll for why.
export const CUSTOMER_POLL_INTERVAL_MS = 4000;
