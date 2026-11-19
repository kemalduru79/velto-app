-- REVIEW ONLY. Never apply directly to production.
-- Evidence digest is an audit reference, not proof verification.
-- Only trusted server-side code may supply verified outcomes.

alter table public.velto_beta_provider_budget_reservations
  add column final_cost_micro_usd bigint,
  add column finalization_evidence_sha256 text,
  add column finalization_basis text,
  add column finalized_at timestamptz;

alter table public.velto_beta_provider_budget_reservations
  add constraint velto_beta_finalization_consistent check (
    (
      state = 'HELD'
      and final_cost_micro_usd is null
      and finalization_evidence_sha256 is null
      and finalization_basis is null
      and finalized_at is null
    )
    or
    (
      state = 'SETTLED'
      and final_cost_micro_usd > 0
      and final_cost_micro_usd <= upper_bound_micro_usd
      and finalization_basis = 'PROVIDER_BILLING_CONFIRMED'
      and finalization_evidence_sha256 ~ '^[a-f0-9]{64}$'
      and finalized_at is not null
    )
    or
    (
      state = 'RELEASED'
      and final_cost_micro_usd = 0
      and finalization_basis in (
        'NO_DISPATCH_CONFIRMED',
        'PROVIDER_ZERO_CHARGE_CONFIRMED'
      )
      and finalization_evidence_sha256 ~ '^[a-f0-9]{64}$'
      and finalized_at is not null
    )
  );

-- Direct reservation UPDATE is prohibited for service_role.

-- P0_7E_BILLING_APPROVAL_LEDGER
-- Review-only schema. No live migration is applied.
-- Approval records require privileged, independently reviewed input.
create table public.velto_beta_provider_billing_approvals (
  attempt_key text primary key
    references public.velto_beta_provider_budget_reservations(attempt_key)
    on delete restrict,
  owner_user_id uuid not null,
  request_sha256 text not null
    check (request_sha256 ~ '^[a-f0-9]{64}$'),
  provider_key text not null
    check (provider_key = 'runway'),
  native_task_id text not null
    check (length(native_task_id) between 1 and 512),
  action text not null
    check (action in ('SETTLE', 'RELEASE')),
  actual_micro_usd bigint not null
    check (actual_micro_usd >= 0),
  evidence_sha256 text not null
    check (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  basis text not null,
  approved_by text not null
    check (length(btrim(approved_by)) >= 3),
  approved_at timestamptz not null default now(),
  constraint velto_beta_billing_approval_consistent check (
    (
      action = 'SETTLE'
      and actual_micro_usd > 0
      and basis = 'PROVIDER_BILLING_CONFIRMED'
    )
    or
    (
      action = 'RELEASE'
      and actual_micro_usd = 0
      and basis = 'PROVIDER_ZERO_CHARGE_CONFIRMED'
    )
  )
);

alter table public.velto_beta_provider_billing_approvals
  enable row level security;

revoke all on public.velto_beta_provider_billing_approvals
  from public, anon, authenticated, service_role;

grant select on public.velto_beta_provider_billing_approvals
  to service_role;

create policy velto_beta_billing_approval_service_read
  on public.velto_beta_provider_billing_approvals
  for select to service_role using (true);

create or replace function public.velto_beta_budget_finalize_v1(
  p_owner_user_id uuid,
  p_attempt_key text,
  p_request_sha256 text,
  p_action text,
  p_actual_micro_usd bigint,
  p_evidence_sha256 text,
  p_basis text
) returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_budget public.velto_beta_provider_budget_limits%rowtype;
  v_res public.velto_beta_provider_budget_reservations%rowtype;
begin
  if p_owner_user_id is null
     or p_attempt_key is null
     or length(p_attempt_key) < 1
     or octet_length(p_attempt_key) > 160
     or p_attempt_key <> btrim(p_attempt_key)
     or p_request_sha256 is null
     or p_request_sha256 !~ '^[a-f0-9]{64}$'
     or p_evidence_sha256 is null
     or p_evidence_sha256 !~ '^[a-f0-9]{64}$'
     or p_action is null
     or p_action not in ('SETTLE', 'RELEASE')
     or p_actual_micro_usd is null then
    return 'DENIED_INVALID_REQUEST';
  end if;

  if p_action = 'SETTLE' then
    if p_actual_micro_usd <= 0
       or p_basis is distinct from 'PROVIDER_BILLING_CONFIRMED' then
      return 'DENIED_INVALID_REQUEST';
    end if;
  else
    if p_actual_micro_usd <> 0
       or p_basis is null
       or p_basis not in (
         'NO_DISPATCH_CONFIRMED',
         'PROVIDER_ZERO_CHARGE_CONFIRMED'
       ) then
      return 'DENIED_INVALID_REQUEST';
    end if;
  end if;

  -- Consistent lock order: budget, then reservation.
  select * into v_budget
    from public.velto_beta_provider_budget_limits
   where owner_user_id = p_owner_user_id
   for update;

  if not found then
    return 'DENIED_NO_AUTHORIZED_BUDGET';
  end if;

  select * into v_res
    from public.velto_beta_provider_budget_reservations
   where attempt_key = p_attempt_key
     and owner_user_id = p_owner_user_id
   for update;

  if not found then
    return 'DENIED_NOT_FOUND_OR_OWNERSHIP';
  end if;

  if v_res.request_sha256 <> p_request_sha256 then
    return 'DENIED_NOT_FOUND_OR_OWNERSHIP';
  end if;

  if v_res.state <> 'HELD' then
    return 'DENIED_ALREADY_FINALIZED';
  end if;

  if p_actual_micro_usd > v_res.upper_bound_micro_usd then
    return 'DENIED_COST_EXCEEDS_HOLD';
  end if;

  if v_budget.held_micro_usd < v_res.upper_bound_micro_usd then
    return 'DENIED_BUDGET_INCONSISTENT';
  end if;

  -- A started but unaccepted provider dispatch remains uncertain.
  -- Never settle it merely because a billing evidence hash was supplied.
  if p_action = 'SETTLE'
     and exists (
       select 1
         from public.velto_beta_provider_dispatch_intents
        where attempt_key = p_attempt_key
          and state = 'DISPATCH_STARTED'
     ) then
    return 'DENIED_PROVIDER_TASK_UNCONFIRMED';
  end if;

  -- P0_STAGE_7D_SETTLE_REQUIRES_ACCEPTED_TASK
  -- A positive settlement must belong to an accepted provider task.
  -- This is necessary, but NOT sufficient, billing evidence.
  if p_action = 'SETTLE'
     and not exists (
       select 1
         from public.velto_beta_provider_dispatch_intents
        where attempt_key = p_attempt_key
          and owner_user_id = p_owner_user_id
          and request_sha256 = p_request_sha256
          and provider_key = 'runway'
          and state = 'PROVIDER_ACCEPTED'
          and native_task_id is not null
     ) then
    return 'DENIED_PROVIDER_ACCEPTANCE_REQUIRED';
  end if;

  -- A claimed zero provider charge cannot release an uncertain
  -- dispatch. Provider acceptance is necessary but is not itself
  -- sufficient proof of a zero charge. Trusted billing verification
  -- must still occur upstream before invoking this function.
  if p_action = 'RELEASE'
     and p_basis = 'PROVIDER_ZERO_CHARGE_CONFIRMED'
     and not exists (
       select 1
         from public.velto_beta_provider_dispatch_intents
        where attempt_key = p_attempt_key
          and state = 'PROVIDER_ACCEPTED'
          and native_task_id is not null
     ) then
    return 'DENIED_PROVIDER_ACCEPTANCE_REQUIRED';
  end if;

  -- Settlement requires a separately approved billing record.
  -- A valid-looking hash by itself is not billing authority.
  if (
       p_action = 'SETTLE'
       or (
         p_action = 'RELEASE'
         and p_basis = 'PROVIDER_ZERO_CHARGE_CONFIRMED'
       )
     )
     and not exists (
       select 1
         from public.velto_beta_provider_billing_approvals a
         join public.velto_beta_provider_dispatch_intents d
           on d.attempt_key = a.attempt_key
        where a.attempt_key = p_attempt_key
          and a.owner_user_id = p_owner_user_id
          and a.request_sha256 = p_request_sha256
          and a.provider_key = 'runway'
          and a.action = p_action
          and a.actual_micro_usd = p_actual_micro_usd
          and a.evidence_sha256 = p_evidence_sha256
          and a.basis = p_basis
          and d.owner_user_id = a.owner_user_id
          and d.request_sha256 = a.request_sha256
          and d.provider_key = a.provider_key
          and d.native_task_id = a.native_task_id
          and d.state = 'PROVIDER_ACCEPTED'
     ) then
    return 'DENIED_UNAPPROVED_BILLING_EVIDENCE';
  end if;

  update public.velto_beta_provider_budget_limits
     set held_micro_usd =
           held_micro_usd - v_res.upper_bound_micro_usd,
         settled_micro_usd =
           settled_micro_usd + case
             when p_action = 'SETTLE'
             then p_actual_micro_usd
             else 0
           end,
         updated_at = now()
   where owner_user_id = p_owner_user_id;

  update public.velto_beta_provider_budget_reservations
     set state = case
           when p_action = 'SETTLE' then 'SETTLED'
           else 'RELEASED'
         end,
         final_cost_micro_usd = p_actual_micro_usd,
         finalization_evidence_sha256 = p_evidence_sha256,
         finalization_basis = p_basis,
         finalized_at = now()
   where attempt_key = p_attempt_key
     and owner_user_id = p_owner_user_id;

  return case
    when p_action = 'SETTLE' then 'SETTLED'
    else 'RELEASED'
  end;
end;
$function$;

revoke all on function public.velto_beta_budget_finalize_v1(
  uuid, text, text, text, bigint, text, text
) from public, anon, authenticated;

grant execute on function public.velto_beta_budget_finalize_v1(
  uuid, text, text, text, bigint, text, text
) to service_role;
