create table if not exists public.mystery_drops (
  id uuid primary key,
  owner_hash text not null check (length(owner_hash) = 64),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists mystery_drops_owner_created on public.mystery_drops(owner_hash, created_at desc);
alter table public.mystery_drops enable row level security;
revoke all on public.mystery_drops from public, anon, authenticated;
grant all on public.mystery_drops to service_role;
