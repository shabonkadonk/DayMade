-- Apply in the Supabase SQL editor. The browser has NO direct table access.
-- Activities and immutable approval snapshots live inside versioned JSON payloads.
create table if not exists public.itineraries (
  id uuid primary key,
  owner_hash text not null check (length(owner_hash) = 64),
  revision integer not null default 1 check (revision > 0),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists itineraries_owner on public.itineraries(owner_hash);
alter table public.itineraries enable row level security;
revoke all on public.itineraries from anon, authenticated;
grant all on public.itineraries to service_role;

create table if not exists public.bookings (
  id uuid primary key,
  itinerary_id uuid not null references public.itineraries(id),
  activity_id text not null,
  revision integer not null check (revision > 0),
  owner_hash text not null check (length(owner_hash) = 64),
  idempotency_key uuid not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (owner_hash, idempotency_key),
  -- Changing the idempotency key or plan revision must not repeat a real-world action.
  unique (itinerary_id, activity_id)
);
alter table public.bookings enable row level security;
revoke all on public.bookings from anon, authenticated;
grant all on public.bookings to service_role;

create table if not exists public.request_limits (
  key text primary key,
  count integer not null,
  reset_at timestamptz not null
);
alter table public.request_limits enable row level security;
revoke all on public.request_limits from anon, authenticated;
grant all on public.request_limits to service_role;

create or replace function public.daymade_rate_limit(rate_key text, max_requests integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare request_count integer;
begin
  delete from request_limits where reset_at < now() - interval '5 minutes';
  insert into request_limits(key, count, reset_at) values (rate_key, 1, now() + interval '1 minute')
  on conflict (key) do update set
    count = case when request_limits.reset_at <= now() then 1 else request_limits.count + 1 end,
    reset_at = case when request_limits.reset_at <= now() then now() + interval '1 minute' else request_limits.reset_at end
  returning count into request_count;
  return request_count <= max_requests;
end;
$$;
revoke all on function public.daymade_rate_limit(text, integer) from public, anon, authenticated;
grant execute on function public.daymade_rate_limit(text, integer) to service_role;