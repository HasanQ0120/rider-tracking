-- Platform admin allowlist: a Supabase Auth user must have a row here to
-- use /admin/* (tenant provisioning, suspension, API keys). Provisioned
-- manually via service role, same pattern as ops_staff.
create table platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table platform_admins enable row level security;

create policy "platform admin reads own membership"
  on platform_admins for select
  to authenticated
  using (user_id = auth.uid());
