-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New
-- query). See src/lib/supabase.js for where the resulting URL/anon key
-- go (.env, copied from .env.example).
--
-- Deliberately just one table, and nothing identifying on it: no email,
-- no name, no IP. Duplicate attempts are handled by an honour-system
-- question in the app itself (not enforced here), so there's no account
-- or personal-data table to worry about from a GDPR angle.
create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  overall_score numeric not null,
  per_grapheme jsonb not null
);

alter table attempts enable row level security;

-- The public (anon) key can add a result and read back the anonymous
-- aggregate (e.g. "X people have taken this, average score Y").
create policy "anon can insert attempts" on attempts
  for insert to anon
  with check (true);

create policy "anon can read attempts" on attempts
  for select to anon
  using (true);
