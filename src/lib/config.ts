export const MAX_ACCURACY_M = 75;
export const LOCATION_MIN_INTERVAL_MS = 3000;
export const IMPLAUSIBLE_SPEED_KMH = 150;
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCKOUT_MINUTES = 15;
export const RESEND_RATE_LIMIT_MINUTES = 2;
// Used consistently for every proximity check: "I've Arrived" gating,
// the customer's independent Complete button, and the rider's Mark
// Complete confirmation flow -- one distance, one meaning, everywhere.
export const PROXIMITY_RADIUS_M = 100;
export const PROXIMITY_SUSTAIN_SECONDS = 90;
export const CONNECTION_LOST_TIMEOUT_S = 25;
export const TOKEN_TIME_BUDGET_HOURS = 4;
export const HISTORY_RETENTION_DAYS = 3;

// Below this movement (meters) since the last accepted point, a change in
// GPS coordinates is treated as noise rather than real movement for the
// purpose of recomputing heading -- consecutive GPS fixes on a stationary
// or near-stationary phone can differ by a few meters in essentially
// random directions, which made the arrow spin/jitter with no real
// movement behind it. Below the threshold, the previous heading is kept
// as-is instead of being recalculated from noise.
export const MIN_HEADING_UPDATE_DISTANCE_M = 8;

// How long the customer has to respond to a rider-initiated delivery
// confirmation prompt before it auto-resolves as delivered (recorded
// distinctly in delivery_confirmed_by as a timeout, not a real "yes").
export const PENDING_CONFIRMATION_TIMEOUT_MINUTES = 30;

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
// see /api/customer/[token]/poll for why. Tightened from 4s so the
// Yes/No delivery-confirmation prompt (and the rider's tokens dying once
// it's answered) shows up quickly without needing genuine push
// infrastructure -- the actual token revocation already happens
// synchronously in the DB the moment the customer responds; this interval
// only affects how soon each page's own display catches up to that.
export const CUSTOMER_POLL_INTERVAL_MS = 2000;

// How often an on-duty (idle, between-deliveries) rider's page sends a
// location ping. Coarser than per-order tracking's LOCATION_MIN_INTERVAL_MS
// -- there's no live customer map depending on it, just staffing/assignment
// decisions, so a slower cadence trades a little freshness for battery life.
export const DUTY_LOCATION_MIN_INTERVAL_MS = 15000;

// A duty-mode or in-progress-order location reading older than this doesn't
// count as "the rider is there" for auto-assignment purposes -- matches the
// spirit of CONNECTION_LOST_TIMEOUT_S but looser, since duty pings are sent
// far less often than per-order ones.
export const DUTY_LOCATION_STALE_TIMEOUT_S = 120;

// Auto-assignment's "nearby" radius around a merchant's pickup point --
// the 300-400m range confirmed with the merchant, using the midpoint.
export const AUTO_ASSIGN_RADIUS_M = 350;

// Default on-duty check-in geofence radius (meters) -- how close a rider
// must be to the merchant's pickup point to successfully go on duty.
// Overridable per-tenant via tenants.duty_checkin_radius_m (null there
// means "use this default"); a mall location and a standalone building
// reasonably want different tolerances, so this is a fallback, not a hard
// global limit.
export const DEFAULT_DUTY_CHECKIN_RADIUS_M = 300;

// The single tenant that today's ops dashboard manages orders/riders for.
// Ops has cross-tenant *visibility* (reads are never filtered), but until a
// real tenant-switcher exists, ops-initiated writes (new order, new rider)
// need exactly one tenant to write into -- this is that tenant's fixed,
// non-changeable merchant_id, same one provisioned in the Phase 1 migration.
export const OPS_HOME_MERCHANT_ID = "MERCHANT001";
