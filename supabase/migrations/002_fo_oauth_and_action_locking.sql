-- Run AFTER 001_daymade.sql. Server-side service-role access only.
create table if not exists public.fo_credentials (
  owner_hash text primary key check (length(owner_hash) = 64),
  encrypted_payload text not null,
  pending_state text,
  pending_expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.fo_credentials enable row level security;
revoke all on public.fo_credentials from public, anon, authenticated;
grant all on public.fo_credentials to service_role;

-- Lock each owner's action stream and the reviewed plan BEFORE claiming an approval.
-- A retry with another key still returns the first action, even after a restart.
create or replace function public.daymade_claim_booking(approval jsonb, guest_owner text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare reviewed_plan itineraries%rowtype; existing_booking bookings%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(guest_owner, 0));
  select * into reviewed_plan from itineraries
    where id = (approval->>'itineraryId')::uuid and owner_hash = guest_owner for update;
  if not found then raise exception 'PLAN_NOT_FOUND'; end if;
  select * into existing_booking from bookings where owner_hash = guest_owner
    and itinerary_id = reviewed_plan.id and activity_id = approval->>'activityId';
  if found then return jsonb_build_object('booking', existing_booking.payload, 'inserted', false); end if;
  if reviewed_plan.revision <> (approval->>'revision')::integer then raise exception 'STALE_APPROVAL'; end if;
  if exists(select 1 from bookings where owner_hash = guest_owner and idempotency_key = (approval->>'idempotencyKey')::uuid)
    then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  if exists(select 1 from bookings where owner_hash = guest_owner and
    (payload->>'status' in ('requested','in_progress') or (payload->>'status' = 'requires_user_action' and payload->>'externalTaskId' is null)))
    then raise exception 'FO_ACTION_IN_PROGRESS'; end if;
  insert into bookings(id,itinerary_id,activity_id,revision,owner_hash,idempotency_key,payload)
    values ((approval->>'id')::uuid,reviewed_plan.id,approval->>'activityId',reviewed_plan.revision,guest_owner,(approval->>'idempotencyKey')::uuid,approval);
  return jsonb_build_object('booking',approval,'inserted',true);
end;
$$;
revoke all on function public.daymade_claim_booking(jsonb,text) from public,anon,authenticated;
grant execute on function public.daymade_claim_booking(jsonb,text) to service_role;

-- Both edits and claims lock the same itinerary row: an old approval cannot race an edit.
create or replace function public.daymade_protect_approved_plan()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists(select 1 from bookings where itinerary_id = old.id) then raise exception 'PLAN_HAS_APPROVALS'; end if;
  return new;
end;
$$;
drop trigger if exists protect_approved_plan on public.itineraries;
create trigger protect_approved_plan before update on public.itineraries
  for each row execute function public.daymade_protect_approved_plan();
