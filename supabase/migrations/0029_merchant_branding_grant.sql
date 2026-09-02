-- Allow merchants to update their own branding columns (lite dashboard + tracking).
revoke update on tenants from authenticated;
grant update (
  auto_assign_enabled,
  default_pickup_lat,
  default_pickup_lng,
  default_pickup_address,
  logo_url,
  primary_color,
  secondary_color,
  accent_color,
  favicon_url
) on tenants to authenticated;
