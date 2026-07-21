# Rider Tracking — Progress Notes

Stopped mid-build to resume later. This file is the "pick back up" doc.

## What's built

**Design is fully agreed** (see the conversation this was built from for the full
spec: two opaque tokens per order, PIN + device-lock rider identity check,
session-based multi-tab handling, speed-plausibility GPS spoof detection,
three-layer expiry — manual tap / sustained-proximity auto-confirm /
time-based fallback reissue — dispute-window location retention, navy/gold/
white palette with hardcoded gold-button-navy-text contrast rule).

**Infrastructure**
- Supabase project `rider-tracking` (ref `esgdxbrllvepoprlsdqa`, org
  `eubzyzowpdwsmsllrmrp`, region ap-southeast-1), free tier.
- Full schema applied via 10 migrations in `supabase/migrations/`: riders,
  orders, tracking_tokens (with partial-unique indexes enforcing "one active
  rider token + one active customer token per order" at the DB level),
  pin_codes, pin_attempts, device_locks, tracking_sessions,
  current_locations + location_history, pending_notifications, ops_staff.
- RLS enabled on every table; the only client-direct policies are "customer
  reads own order location" and "customer reads own order" (both gated on a
  custom JWT's `order_id` claim) — everything else goes through service-role
  Route Handlers.
- `check_and_expire_orders()` runs every 30s via `pg_cron` (proximity
  auto-confirm + time-based reissue). Nightly purge job for old
  `location_history`.
- Ran the security advisor after the first schema pass and fixed two real
  issues it caught: mutable `search_path` on all functions, and
  SECURITY DEFINER functions being callable directly by `anon`/`authenticated`
  via PostgREST RPC (now revoked, service_role only).
- Ops login provisioned: `waqar246@gmail.com` (Supabase Auth user + matching
  `ops_staff` row). Password was set during setup and isn't recorded here on
  purpose -- check/reset it via the Supabase dashboard's Auth > Users panel
  if needed, rather than keeping a real credential in this file.

**App (Next.js 16, App Router, TypeScript, Tailwind v4)**
- `src/lib/` — config constants, Supabase clients (service/browser/auth),
  token+PIN generation (bcryptjs, compatible with the pgcrypto hashes the
  cron path generates), geo (haversine + speed-plausibility), notification
  abstraction (`sendNotification` → swappable provider, currently a
  console-log stub with secret-masking already wired in).
- Rider flow: `/rider/[token]` + API routes for init/verify-pin/location/
  arrived/complete/resend. Handles device-lock, session supersession,
  PIN lockout, accuracy rejection, speed flagging.
- Customer flow: `/customer/[token]` + API routes for init (mints a
  short-lived JWT for Realtime auth, re-minted every 10 min) and complete
  (server-enforced arrival/proximity gate, not just a hidden UI button).
- Ops panel: `/ops/login`, `/ops` (orders list), `/ops/orders/new`
  (Nominatim-based address picker, proxied server-side via `/api/geocode`),
  `/ops/orders/[id]` (assign with
  reassignment confirmation, reset-tracking-session, cancel), `/ops/riders`.
  Gated by `middleware.ts` (session check) + `requireOpsUser()` /
  `requireOpsUserApi()` (ops_staff membership check).
- `npm run build` passes clean (TypeScript + Next build, no errors).

## What's still pending

1. **Map tiles use the raw public OSM server by deliberate, accepted risk.**
   `TrackingMap.tsx` loads tiles from `tile.openstreetmap.org` directly — no
   API key, no account, works out of the box. The tradeoff: that server
   offers no SLA and can block access without notice if traffic looks
   automated (checked Stadia Maps and MapTiler as alternatives first — both
   explicitly ban commercial use on their free tiers, requiring a paid plan
   from day one; this was a deliberate choice to accept the raw-server risk
   instead). If tiles ever stop loading, the fix is swapping the one
   `L.tileLayer(...)` URL in `TrackingMap.tsx` for a paid host (Stadia
   Starter, $20/mo, already scoped). No env var needed for tiles anymore.
   Geocoding (address search on `/ops/orders/new`) is separately proxied
   through `/api/geocode` to Nominatim — set `NOMINATIM_USER_AGENT` in
   `.env.local` to a real contact before going live (Nominatim's policy
   requires an identifying value, not the placeholder default).
2. **Never actually run yet.** `npm run dev` has not been started against
   live data — no real end-to-end pass (create order → assign rider → open
   rider link → PIN → simulate GPS via DevTools → watch customer map update
   → complete) has happened. Everything below "builds cleanly" is unverified
   at runtime.
3. **SMS/WhatsApp provider still undecided** (by design, per earlier
   discussion) — `src/lib/notify/providers/console.ts` just logs to the
   server console with tokens/PINs masked. Real links/PINs currently only
   reach you by watching `npm run dev`'s terminal output, not an actual
   phone. Fine for local testing, not usable for a real rider yet.
4. **Notification queue processor** (`/api/internal/process-notifications`,
   for the cron-driven token-reissue path) is written but not wired to any
   scheduler — nothing calls it automatically yet. Not needed for a first
   local test (token reissue only fires after the 4-hour rider token budget
   expires), but needed before this matters in practice.
5. No automated tests were written (manual verification plan only, see
   below).

## How to resume

```
cd D:\Rider_Deleivery
npm run dev
```

Then:
1. Open http://localhost:3000/ops/login, sign in with the credentials above.
2. Add a rider (`/ops/riders`), create an order (`/ops/orders/new` —
   geocodes the address via Nominatim, no key needed), assign the rider to
   it.
3. **Known friction point for local testing:** the console stub
   (`src/lib/notify/providers/console.ts`) masks tokens/PINs before printing
   (e.g. `abcd…wxyz`, PIN as `••••••`) — correct for production log hygiene,
   but it means you can't read the real values off the terminal. Easiest
   workaround for a manual test pass: the ops UI itself already displays the
   full rider/customer *links* on the order detail page
   (`/ops/orders/[id]`) once assigned, so links aren't a problem — only the
   PIN is masked everywhere and nowhere in plaintext (`pin_codes` only
   stores a bcrypt hash). If you need to actually test the PIN step, either
   temporarily bypass the mask in `console.ts` while testing locally, or
   query `tracking_tokens.pending_plaintext_pin` right after an ops
   assignment (it's set transiently during the cron-reissue path, but not
   during a normal ops assign — normal assigns never persist the plaintext
   PIN anywhere, by design). The straightforward fix is a small temporary
   edit to `console.ts` to also log the *unmasked* message when
   `NODE_ENV !== "production"`, if you want that convenience later.
4. Open the rider link in one tab, the customer link in another.
5. On the rider tab: enter the PIN, tap "Start Sharing My Location". Chrome
   DevTools → More Tools → Sensors → Location lets you fake GPS coordinates
   without physically moving (see the original design doc's "How to test
   it" section for the full edge-case test list: device-lock on a second
   device, multi-tab supersession, PIN lockout after 5 wrong attempts,
   accuracy rejection, proximity auto-confirm, time-based expiry).
6. Confirm the customer tab's map marker updates live as you move the fake
   GPS position.

## Key files if you need to jump back into the code

- Schema/logic: `supabase/migrations/0005_functions_triggers.sql` (the
  expiry/completion functions), `supabase/migrations/0002_tracking_tokens.sql`
- Rider core logic: `src/app/rider/[token]/RiderTrackingClient.tsx`,
  `src/app/api/rider/[token]/location/route.ts`
- Customer core logic: `src/app/customer/[token]/CustomerTrackingClient.tsx`,
  `src/app/api/customer/[token]/init/route.ts`
- Notifications: `src/lib/notify/index.ts` (swap the provider here later)
- Ops assign logic: `src/app/api/ops/orders/[id]/assign/route.ts`
