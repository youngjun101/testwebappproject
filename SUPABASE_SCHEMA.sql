-- Run this in Supabase → SQL Editor after creating your project.

create table if not exists public.user_roles (
  id uuid references auth.users on delete cascade,
  role text check (role in ('super_admin', 'operator')),
  primary key (id)
);

-- Row-Level Security: any signed-in user can read their own role row
-- (the frontend uses this to decide whether to show the Admin link).
alter table public.user_roles enable row level security;

drop policy if exists "users read their own role" on public.user_roles;
create policy "users read their own role"
  on public.user_roles for select
  using (auth.uid() = id);

-- All writes go through the Vercel serverless functions using the
-- service role key, which bypasses RLS — so no insert/update/delete
-- policies are needed here.

-- After running this, manually:
-- 1. Authentication → Users → Add user → create your seed super admin email + password.
-- 2. Copy that user's UUID, then run:
--      insert into public.user_roles (id, role)
--      values ('PASTE-UUID-HERE', 'super_admin');
