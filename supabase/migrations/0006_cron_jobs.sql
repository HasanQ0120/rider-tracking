create extension if not exists pg_cron;

select cron.schedule(
  'check-and-expire-orders',
  '30 seconds',
  $$ select check_and_expire_orders(); $$
);

select cron.schedule(
  'purge-old-location-history',
  '0 3 * * *',
  $$ select purge_old_location_history(); $$
);
