-- Public bucket for merchant tenant logos (uploaded via API using service role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant-logos',
  'tenant-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Anyone can read logos (dashboard, customer tracking, rider app).
drop policy if exists "Public read tenant logos" on storage.objects;
create policy "Public read tenant logos"
  on storage.objects for select
  to public
  using (bucket_id = 'tenant-logos');
