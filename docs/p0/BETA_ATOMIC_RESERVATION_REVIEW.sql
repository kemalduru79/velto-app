-- REVIEW ONLY. Do not apply to a real Supabase project.
-- No budget rows are seeded. Missing owner budget fails closed.
-- Reservations remain held until a reviewed settlement protocol exists.

create table if not exists public.velto_beta_provider_budget_limits (
  owner_user_id uuid primary key references auth.users(id),
  cap_micro_usd bigint not null check (cap_micro_usd > 0),
  settled_micro_usd bigint not null default 0 check (settled_micro_usd >= 0),
  held_micro_usd bigint not null default 0 check (held_micro_usd >= 0),
  updated_at timestamptz not null default now(),
  constraint velto_beta_budget_within_cap check (
    settled_micro_usd <= cap_micro_usd
    and held_micro_usd <= cap_micro_usd - settled_micro_usd
  )
);

create table if not exists public.velto_beta_provider_budget_reservations (
  attempt_key text primary key check (length(attempt_key) between 1 and 160),
  owner_user_id uuid not null references public.velto_beta_provider_budget_limits(owner_user_id),
  request_sha256 text not null check (request_sha256 ~ '^[a-f0-9]{64}$'),
  upper_bound_micro_usd bigint not null check (upper_bound_micro_usd > 0),
  state text not null default 'HELD'
    check (state in ('HELD', 'SETTLED', 'RELEASED')),
  created_at timestamptz not null default now()
);

alter table public.velto_beta_provider_budget_limits enable row level security;
alter table public.velto_beta_provider_budget_reservations enable row level security;

revoke all on table public.velto_beta_provider_budget_limits
  from public, anon, authenticated, service_role;
revoke all on table public.velto_beta_provider_budget_reservations
  from public, anon, authenticated, service_role;

grant select on public.velto_beta_provider_budget_limits to service_role;
grant select on public.velto_beta_provider_budget_reservations to service_role;

create or replace function public.velto_beta_budget_reserve_v1(
  p_owner_user_id uuid,
  p_attempt_key text,
  p_request_sha256 text,
  p_cost_upper_bound_micro_usd bigint
) returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_budget public.velto_beta_provider_budget_limits%rowtype;
  v_inserted_key text;
begin
  if p_owner_user_id is null
     or p_attempt_key is null
     or length(btrim(p_attempt_key)) = 0
     or octet_length(p_attempt_key) > 160
     or p_attempt_key <> btrim(p_attempt_key)
     or p_request_sha256 is null
     or p_request_sha256 !~ '^[a-f0-9]{64}$'
     or p_cost_upper_bound_micro_usd is null
     or p_cost_upper_bound_micro_usd <= 0 then
    return 'DENIED_INVALID_REQUEST';
  end if;

  select * into v_budget
    from public.velto_beta_provider_budget_limits
   where owner_user_id = p_owner_user_id
   for update;

  if not found then
    return 'DENIED_NO_AUTHORIZED_BUDGET';
  end if;

  if p_cost_upper_bound_micro_usd >
     (v_budget.cap_micro_usd -
      v_budget.settled_micro_usd -
      v_budget.held_micro_usd) then
    return 'DENIED_HARD_CAP';
  end if;

  insert into public.velto_beta_provider_budget_reservations
    (attempt_key, owner_user_id, request_sha256, upper_bound_micro_usd)
  values (
    p_attempt_key,
    p_owner_user_id,
    p_request_sha256,
    p_cost_upper_bound_micro_usd
  )
  on conflict (attempt_key) do nothing
  returning attempt_key into v_inserted_key;

  if v_inserted_key is null then
    return 'DENIED_DUPLICATE_ATTEMPT';
  end if;

  update public.velto_beta_provider_budget_limits
     set held_micro_usd = held_micro_usd + p_cost_upper_bound_micro_usd,
         updated_at = now()
   where owner_user_id = p_owner_user_id;

  return 'RESERVED';
end;
$function$;

revoke all on function public.velto_beta_budget_reserve_v1(
  uuid, text, text, bigint
) from public, anon, authenticated;

grant execute on function public.velto_beta_budget_reserve_v1(
  uuid, text, text, bigint
) to service_role;
