-- P0 REVIEW ONLY. Never applied to live Supabase.
-- A dispatch intent is recorded BEFORE the external provider call.
-- A started dispatch is never evidence of zero provider charge.

create table public.velto_beta_provider_dispatch_intents (
  attempt_key text primary key
    references public.velto_beta_provider_budget_reservations(attempt_key)
    on delete restrict,
  owner_user_id uuid not null
    references public.velto_beta_provider_budget_limits(owner_user_id),
  request_sha256 text not null
    check (request_sha256 ~ '^[a-f0-9]{64}$'),
  provider_key text not null check (provider_key = 'runway'),
  state text not null check (
    state in ('DISPATCH_STARTED', 'PROVIDER_ACCEPTED')
  ),
  native_task_id text,
  started_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint velto_beta_dispatch_state_consistent check (
    (
      state = 'DISPATCH_STARTED'
      and native_task_id is null
      and accepted_at is null
    )
    or
    (
      state = 'PROVIDER_ACCEPTED'
      and length(native_task_id) between 1 and 512
      and accepted_at is not null
    )
  )
);

create unique index velto_beta_provider_native_task_unique
  on public.velto_beta_provider_dispatch_intents
  (provider_key, native_task_id)
  where native_task_id is not null;

alter table public.velto_beta_provider_dispatch_intents
  enable row level security;

revoke all on public.velto_beta_provider_dispatch_intents
  from public, anon, authenticated;

grant select, insert, update
  on public.velto_beta_provider_dispatch_intents
  to service_role;

-- Lock order: budget -> reservation -> dispatch intent.
-- Matches the existing reservation/finalization lock order.
create function public.velto_beta_budget_begin_dispatch_v1(
  p_owner_user_id uuid,
  p_attempt_key text,
  p_request_sha256 text,
  p_provider_key text
)
returns text
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_budget uuid;
  v_reservation record;
begin
  if p_owner_user_id is null
     or p_attempt_key is null
     or length(p_attempt_key) not between 1 and 160
     or p_request_sha256 is null
     or p_request_sha256 !~ '^[a-f0-9]{64}$'
     or p_provider_key is distinct from 'runway' then
    return 'DENIED_INVALID_REQUEST';
  end if;

  select owner_user_id into v_budget
    from public.velto_beta_provider_budget_limits
   where owner_user_id = p_owner_user_id
   for update;

  if not found then
    return 'DENIED_NO_AUTHORIZED_BUDGET';
  end if;

  select * into v_reservation
    from public.velto_beta_provider_budget_reservations
   where attempt_key = p_attempt_key
     and owner_user_id = p_owner_user_id
   for update;

  if not found then
    return 'DENIED_NOT_FOUND_OR_OWNERSHIP';
  end if;

  if v_reservation.request_sha256 <> p_request_sha256 then
    return 'DENIED_REQUEST_IDENTITY_MISMATCH';
  end if;

  if v_reservation.state <> 'HELD' then
    return 'DENIED_RESERVATION_NOT_HELD';
  end if;

  if exists (
    select 1 from public.velto_beta_provider_dispatch_intents
     where attempt_key = p_attempt_key
  ) then
    return 'DENIED_DUPLICATE_DISPATCH';
  end if;

  insert into public.velto_beta_provider_dispatch_intents (
    attempt_key, owner_user_id, request_sha256,
    provider_key, state
  ) values (
    p_attempt_key, p_owner_user_id, p_request_sha256,
    p_provider_key, 'DISPATCH_STARTED'
  );

  return 'DISPATCH_STARTED';
end;
$function$;

revoke all on function public.velto_beta_budget_begin_dispatch_v1(
  uuid, text, text, text
) from public, anon, authenticated;

grant execute on function public.velto_beta_budget_begin_dispatch_v1(
  uuid, text, text, text
) to service_role;

-- Persist the provider's task ID without creating a second dispatch.
create function public.velto_beta_budget_accept_dispatch_v1(
  p_owner_user_id uuid,
  p_attempt_key text,
  p_request_sha256 text,
  p_native_task_id text
)
returns text
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_budget uuid;
  v_reservation record;
  v_intent record;
begin
  if p_owner_user_id is null
     or p_attempt_key is null
     or p_request_sha256 is null
     or p_native_task_id is null
     or length(p_native_task_id) not between 1 and 512
     or p_native_task_id !~ '^[a-zA-Z0-9._:/-]+$' then
    return 'DENIED_INVALID_REQUEST';
  end if;

  select owner_user_id into v_budget
    from public.velto_beta_provider_budget_limits
   where owner_user_id = p_owner_user_id
   for update;

  if not found then
    return 'DENIED_NO_AUTHORIZED_BUDGET';
  end if;

  select * into v_reservation
    from public.velto_beta_provider_budget_reservations
   where attempt_key = p_attempt_key
     and owner_user_id = p_owner_user_id
   for update;

  if not found then
    return 'DENIED_NOT_FOUND_OR_OWNERSHIP';
  end if;

  if v_reservation.request_sha256 <> p_request_sha256
     or v_reservation.state <> 'HELD' then
    return 'DENIED_RESERVATION_STATE_OR_IDENTITY';
  end if;

  select * into v_intent
    from public.velto_beta_provider_dispatch_intents
   where attempt_key = p_attempt_key
     and owner_user_id = p_owner_user_id
     and request_sha256 = p_request_sha256
   for update;

  if not found then
    return 'DENIED_NO_DISPATCH_INTENT';
  end if;

  if v_intent.state <> 'DISPATCH_STARTED' then
    return 'DENIED_DUPLICATE_ACCEPT';
  end if;

  update public.velto_beta_provider_dispatch_intents
     set state = 'PROVIDER_ACCEPTED',
         native_task_id = p_native_task_id,
         accepted_at = now()
   where attempt_key = p_attempt_key;

  return 'PROVIDER_ACCEPTED';
end;
$function$;

revoke all on function public.velto_beta_budget_accept_dispatch_v1(
  uuid, text, text, text
) from public, anon, authenticated;

grant execute on function public.velto_beta_budget_accept_dispatch_v1(
  uuid, text, text, text
) to service_role;

-- A dispatch intent can exist even when no provider task ID was returned.
-- In that case the financial exposure remains uncertain.
-- This trigger fences the existing finalization RPC as well as direct
-- reservation updates through ordinary privileged SQL.
create function public.velto_beta_guard_no_dispatch_release_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
begin
  if new.state = 'RELEASED'
     and new.finalization_basis = 'NO_DISPATCH_CONFIRMED'
     and exists (
       select 1
         from public.velto_beta_provider_dispatch_intents
        where attempt_key = new.attempt_key
     ) then
    raise exception
      'P0_DISPATCH_STARTED_CANNOT_CONFIRM_NO_DISPATCH'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function public.velto_beta_guard_no_dispatch_release_v1()
  from public, anon, authenticated;

create trigger velto_beta_no_false_release_guard
before update of state, finalization_basis
on public.velto_beta_provider_budget_reservations
for each row
execute function public.velto_beta_guard_no_dispatch_release_v1();
