-- The customer page no longer subscribes to Supabase Realtime directly
-- from the browser (that required a custom-signed JWT, which this
-- project's Realtime service rejected outright -- see the app's commit
-- history / PROGRESS.md). It now polls a service-role-backed Next.js API
-- route instead, matching every other table's access pattern in this app.
-- These policies depended entirely on that removed JWT flow and are now
-- unreachable dead code; dropping them for clarity.
drop policy if exists "customer reads own order location" on current_locations;
drop policy if exists "customer reads own order" on orders;
