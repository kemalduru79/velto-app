-- FIN-P1C — Credit reconciliation, expiry and idempotency hardening
-- Apply after:
--   20260728_foundation_p1_auth_credit_ledger.sql
--   20260730_scale_p1_job_queue.sql
--   20260730_cancel_p1_job_cancellation.sql

begin;

create or replace function public.velto_credit_expire_reservations(
  p_user_id uuid default null,
  p_batch_limit integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_batch_limit, 200), 1000));
  v_reservation public.velto_credit_reservations%rowtype;
  v_account public.velto_credit_accounts%rowtype;
  v_expired_count integer := 0;
  v_expired_credits bigint := 0;
begin
  for v_reservation in
    select r.*
      from public.velto_credit_reservations r
     where r.status = 'reserved'
       and r.expires_at <= now()
       and (p_user_id is null or r.user_id = p_user_id)
       -- A provider request ID means external cost exposure may already exist.
       -- Such reservations must be settled by reconciliation, never expired.
       and r.provider_request_id is null
       -- Older video jobs may carry the dispatch marker only in the job payload.
       and not exists (
         select 1
           from public.velto_jobs j
          where j.job_type = 'video_reconcile'
            and j.payload->>'creditReservationId' = r.id::text
            and coalesce(j.payload->>'creditSettlementMode', '') = 'provider_dispatch'
       )
     order by r.expires_at asc
     for update skip locked
     limit v_limit
  loop
    insert into public.velto_credit_accounts(user_id)
    values (v_reservation.user_id)
    on conflict (user_id) do nothing;

    select *
      into v_account
      from public.velto_credit_accounts
     where user_id = v_reservation.user_id
     for update;

    if v_account.reserved_credits < v_reservation.reserved_credits then
      raise exception 'CREDIT_ACCOUNT_INCONSISTENT';
    end if;

    update public.velto_credit_accounts
       set reserved_credits = reserved_credits - v_reservation.reserved_credits,
           updated_at = now()
     where user_id = v_reservation.user_id
    returning * into v_account;

    update public.velto_credit_reservations
       set status = 'expired',
           metadata = metadata || jsonb_build_object(
             'expired_at', now(),
             'expire_reason', 'reservation_timeout'
           ),
           updated_at = now()
     where id = v_reservation.id
       and status = 'reserved';

    if found then
      insert into public.velto_credit_ledger(
        user_id,
        reservation_id,
        entry_type,
        balance_delta,
        reserved_delta,
        balance_after,
        reserved_after,
        operation_type,
        provider,
        reference_id,
        idempotency_key,
        metadata
      ) values (
        v_reservation.user_id,
        v_reservation.id,
        'expire',
        0,
        -v_reservation.reserved_credits,
        v_account.balance_credits,
        v_account.reserved_credits,
        v_reservation.operation_type,
        v_reservation.provider,
        v_reservation.reference_id,
        'expire:' || v_reservation.id::text,
        jsonb_build_object('expire_reason', 'reservation_timeout')
      )
      on conflict (user_id, idempotency_key)
        where idempotency_key is not null
      do nothing;

      v_expired_count := v_expired_count + 1;
      v_expired_credits := v_expired_credits + v_reservation.reserved_credits;
    end if;
  end loop;

  return jsonb_build_object(
    'expiredCount', v_expired_count,
    'expiredCredits', v_expired_credits
  );
end;
$$;

create or replace function public.velto_credit_get_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.velto_credit_accounts(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  -- Opportunistic cleanup keeps stale reservations from blocking a user even
  -- when the queue worker is temporarily offline.
  perform public.velto_credit_expire_reservations(p_user_id, 100);

  return public.velto_credit_account_json(p_user_id);
end;
$$;

create or replace function public.velto_credit_reserve(
  p_user_id uuid,
  p_credits bigint,
  p_operation_type text,
  p_idempotency_key text,
  p_provider text default null,
  p_reference_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.velto_credit_accounts%rowtype;
  v_existing public.velto_credit_reservations%rowtype;
  v_reservation public.velto_credit_reservations%rowtype;
  v_key text := nullif(trim(p_idempotency_key), '');
  v_operation text := nullif(trim(p_operation_type), '');
  v_provider text := nullif(trim(p_provider), '');
  v_reference text := nullif(trim(p_reference_id), '');
begin
  if p_credits is null or p_credits <= 0 then
    raise exception 'INVALID_CREDIT_AMOUNT';
  end if;

  if v_key is null or v_operation is null then
    raise exception 'INVALID_CREDIT_INPUT';
  end if;

  -- Serialize equal user/key requests before any provider can be dispatched.
  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || v_key, 0)
  );

  insert into public.velto_credit_accounts(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  perform public.velto_credit_expire_reservations(p_user_id, 100);

  select *
    into v_existing
    from public.velto_credit_reservations
   where user_id = p_user_id
     and idempotency_key = v_key;

  if found then
    if v_existing.reserved_credits <> p_credits
       or v_existing.operation_type <> v_operation
       or coalesce(v_existing.provider, '') <> coalesce(v_provider, '')
       or coalesce(v_existing.reference_id, '') <> coalesce(v_reference, '') then
      raise exception 'IDEMPOTENCY_KEY_CONFLICT';
    end if;

    return jsonb_build_object(
      'account', public.velto_credit_account_json(p_user_id),
      'reservation', public.velto_credit_reservation_json(v_existing.id),
      'idempotency_replay', true
    );
  end if;

  select *
    into v_account
    from public.velto_credit_accounts
   where user_id = p_user_id
   for update;

  if (v_account.balance_credits - v_account.reserved_credits) < p_credits then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  insert into public.velto_credit_reservations(
    user_id,
    operation_type,
    provider,
    reference_id,
    reserved_credits,
    idempotency_key,
    metadata,
    expires_at
  ) values (
    p_user_id,
    v_operation,
    v_provider,
    v_reference,
    p_credits,
    v_key,
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_expires_at, now() + interval '30 minutes')
  ) returning * into v_reservation;

  update public.velto_credit_accounts
     set reserved_credits = reserved_credits + p_credits,
         updated_at = now()
   where user_id = p_user_id
  returning * into v_account;

  insert into public.velto_credit_ledger(
    user_id,
    reservation_id,
    entry_type,
    balance_delta,
    reserved_delta,
    balance_after,
    reserved_after,
    operation_type,
    provider,
    reference_id,
    idempotency_key,
    metadata
  ) values (
    p_user_id,
    v_reservation.id,
    'reserve',
    0,
    p_credits,
    v_account.balance_credits,
    v_account.reserved_credits,
    v_operation,
    v_provider,
    v_reference,
    'reserve:' || v_key,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return jsonb_build_object(
    'account', public.velto_credit_account_json(p_user_id),
    'reservation', public.velto_credit_reservation_json(v_reservation.id),
    'idempotency_replay', false
  );
end;
$$;

create or replace function public.velto_credit_mark_provider_dispatch(
  p_user_id uuid,
  p_reservation_id uuid,
  p_provider_request_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.velto_credit_reservations%rowtype;
  v_provider_request_id text := nullif(trim(p_provider_request_id), '');
  v_replay boolean := false;
begin
  if v_provider_request_id is null then
    raise exception 'INVALID_PROVIDER_REQUEST_ID';
  end if;

  select *
    into v_reservation
    from public.velto_credit_reservations
   where id = p_reservation_id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;

  if v_reservation.status not in ('reserved', 'settled') then
    raise exception 'INVALID_RESERVATION_STATE';
  end if;

  if v_reservation.provider_request_id is not null
     and v_reservation.provider_request_id <> v_provider_request_id then
    raise exception 'IDEMPOTENCY_KEY_CONFLICT';
  end if;

  v_replay := v_reservation.provider_request_id is not null;

  update public.velto_credit_reservations
     set provider_request_id = coalesce(provider_request_id, v_provider_request_id),
         metadata = metadata
           || jsonb_build_object(
                'provider_dispatched', true,
                'provider_dispatched_at',
                  coalesce(metadata->'provider_dispatched_at', to_jsonb(now()))
              )
           || coalesce(p_metadata, '{}'::jsonb),
         updated_at = now()
   where id = p_reservation_id
  returning * into v_reservation;

  return jsonb_build_object(
    'account', public.velto_credit_account_json(p_user_id),
    'reservation', public.velto_credit_reservation_json(v_reservation.id),
    'idempotency_replay', v_replay
  );
end;
$$;

create or replace function public.velto_credit_settle(
  p_user_id uuid,
  p_reservation_id uuid,
  p_final_credits bigint,
  p_provider_cost_usd numeric default null,
  p_provider_request_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.velto_credit_accounts%rowtype;
  v_reservation public.velto_credit_reservations%rowtype;
  v_extra bigint;
  v_provider_request_id text := nullif(trim(p_provider_request_id), '');
begin
  if p_final_credits is null or p_final_credits <= 0 then
    raise exception 'INVALID_CREDIT_AMOUNT';
  end if;

  select *
    into v_reservation
    from public.velto_credit_reservations
   where id = p_reservation_id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;

  if v_reservation.status = 'settled' then
    if v_reservation.settled_credits <> p_final_credits
       or (
         v_provider_request_id is not null
         and v_reservation.provider_request_id is not null
         and v_reservation.provider_request_id <> v_provider_request_id
       ) then
      raise exception 'IDEMPOTENCY_KEY_CONFLICT';
    end if;

    return jsonb_build_object(
      'account', public.velto_credit_account_json(p_user_id),
      'reservation', public.velto_credit_reservation_json(v_reservation.id),
      'idempotency_replay', true
    );
  end if;

  if v_reservation.status <> 'reserved' then
    raise exception 'INVALID_RESERVATION_STATE';
  end if;

  if v_reservation.provider_request_id is not null
     and v_provider_request_id is not null
     and v_reservation.provider_request_id <> v_provider_request_id then
    raise exception 'IDEMPOTENCY_KEY_CONFLICT';
  end if;

  select *
    into v_account
    from public.velto_credit_accounts
   where user_id = p_user_id
   for update;

  if not found or v_account.reserved_credits < v_reservation.reserved_credits then
    raise exception 'CREDIT_ACCOUNT_INCONSISTENT';
  end if;

  v_extra := greatest(0, p_final_credits - v_reservation.reserved_credits);

  if (v_account.balance_credits - v_account.reserved_credits) < v_extra then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  update public.velto_credit_accounts
     set balance_credits = balance_credits - p_final_credits,
         reserved_credits = reserved_credits - v_reservation.reserved_credits,
         lifetime_used_credits = lifetime_used_credits + p_final_credits,
         updated_at = now()
   where user_id = p_user_id
  returning * into v_account;

  update public.velto_credit_reservations
     set settled_credits = p_final_credits,
         status = 'settled',
         provider_cost_usd = coalesce(p_provider_cost_usd, provider_cost_usd),
         provider_request_id = coalesce(v_provider_request_id, provider_request_id),
         metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
         updated_at = now()
   where id = p_reservation_id
  returning * into v_reservation;

  insert into public.velto_credit_ledger(
    user_id,
    reservation_id,
    entry_type,
    balance_delta,
    reserved_delta,
    balance_after,
    reserved_after,
    operation_type,
    provider,
    reference_id,
    idempotency_key,
    provider_cost_usd,
    provider_request_id,
    metadata
  ) values (
    p_user_id,
    v_reservation.id,
    'settle',
    -p_final_credits,
    -v_reservation.reserved_credits,
    v_account.balance_credits,
    v_account.reserved_credits,
    v_reservation.operation_type,
    v_reservation.provider,
    v_reservation.reference_id,
    'settle:' || v_reservation.id::text,
    p_provider_cost_usd,
    coalesce(v_provider_request_id, v_reservation.provider_request_id),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, idempotency_key)
    where idempotency_key is not null
  do nothing;

  return jsonb_build_object(
    'account', public.velto_credit_account_json(p_user_id),
    'reservation', public.velto_credit_reservation_json(v_reservation.id),
    'idempotency_replay', false
  );
end;
$$;

create or replace function public.velto_credit_release(
  p_user_id uuid,
  p_reservation_id uuid,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.velto_credit_accounts%rowtype;
  v_reservation public.velto_credit_reservations%rowtype;
begin
  select *
    into v_reservation
    from public.velto_credit_reservations
   where id = p_reservation_id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;

  if v_reservation.status in ('released', 'expired') then
    return jsonb_build_object(
      'account', public.velto_credit_account_json(p_user_id),
      'reservation', public.velto_credit_reservation_json(v_reservation.id),
      'idempotency_replay', true
    );
  end if;

  if v_reservation.status <> 'reserved' then
    raise exception 'INVALID_RESERVATION_STATE';
  end if;

  -- Once dispatch is persisted, release would create an unbilled provider cost.
  if v_reservation.provider_request_id is not null then
    raise exception 'INVALID_RESERVATION_STATE';
  end if;

  select *
    into v_account
    from public.velto_credit_accounts
   where user_id = p_user_id
   for update;

  if not found or v_account.reserved_credits < v_reservation.reserved_credits then
    raise exception 'CREDIT_ACCOUNT_INCONSISTENT';
  end if;

  update public.velto_credit_accounts
     set reserved_credits = reserved_credits - v_reservation.reserved_credits,
         updated_at = now()
   where user_id = p_user_id
  returning * into v_account;

  update public.velto_credit_reservations
     set status = 'released',
         metadata = metadata
           || jsonb_build_object('release_reason', p_reason)
           || coalesce(p_metadata, '{}'::jsonb),
         updated_at = now()
   where id = p_reservation_id
  returning * into v_reservation;

  insert into public.velto_credit_ledger(
    user_id,
    reservation_id,
    entry_type,
    balance_delta,
    reserved_delta,
    balance_after,
    reserved_after,
    operation_type,
    provider,
    reference_id,
    idempotency_key,
    metadata
  ) values (
    p_user_id,
    v_reservation.id,
    'release',
    0,
    -v_reservation.reserved_credits,
    v_account.balance_credits,
    v_account.reserved_credits,
    v_reservation.operation_type,
    v_reservation.provider,
    v_reservation.reference_id,
    'release:' || v_reservation.id::text,
    jsonb_build_object('release_reason', p_reason)
      || coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, idempotency_key)
    where idempotency_key is not null
  do nothing;

  return jsonb_build_object(
    'account', public.velto_credit_account_json(p_user_id),
    'reservation', public.velto_credit_reservation_json(v_reservation.id),
    'idempotency_replay', false
  );
end;
$$;

create or replace function public.velto_fin_reconcile(
  p_batch_limit integer default 200,
  p_stale_job_minutes integer default 10,
  p_source text default 'manual'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_batch_limit, 200), 1000));
  v_stale_minutes integer := greatest(1, least(coalesce(p_stale_job_minutes, 10), 1440));
  v_source text := coalesce(nullif(trim(p_source), ''), 'manual');
  v_reservation public.velto_credit_reservations%rowtype;
  v_provider_request_id text;
  v_settled_count integer := 0;
  v_settled_credits bigint := 0;
  v_settlement_errors integer := 0;
  v_jobs_failed integer := 0;
  v_expire_result jsonb := '{}'::jsonb;
begin
  -- Settle any reservation for which provider dispatch was durably recorded,
  -- including terminal/cancelled video jobs and orphaned queue-creation cases.
  for v_reservation in
    select r.*
      from public.velto_credit_reservations r
     where r.status = 'reserved'
       and (
         r.provider_request_id is not null
         or exists (
           select 1
             from public.velto_jobs j
            where j.job_type = 'video_reconcile'
              and j.payload->>'creditReservationId' = r.id::text
              and coalesce(j.payload->>'creditSettlementMode', '') = 'provider_dispatch'
         )
       )
     order by r.created_at asc
     for update skip locked
     limit v_limit
  loop
    select coalesce(
      v_reservation.provider_request_id,
      (
        select nullif(j.payload->>'nativeTaskId', '')
          from public.velto_jobs j
         where j.job_type = 'video_reconcile'
           and j.payload->>'creditReservationId' = v_reservation.id::text
         order by j.created_at asc
         limit 1
      )
    ) into v_provider_request_id;

    begin
      perform public.velto_credit_settle(
        v_reservation.user_id,
        v_reservation.id,
        v_reservation.reserved_credits,
        v_reservation.provider_cost_usd,
        v_provider_request_id,
        jsonb_build_object(
          'reconciled', true,
          'reconciled_at', now(),
          'reconciliation_source', v_source
        )
      );
      v_settled_count := v_settled_count + 1;
      v_settled_credits := v_settled_credits + v_reservation.reserved_credits;
    exception
      when others then
        v_settlement_errors := v_settlement_errors + 1;
    end;
  end loop;

  -- Jobs that exhausted all attempts and no longer hold a valid lease cannot be
  -- claimed again. Mark them terminal instead of leaving them permanently stuck.
  with candidates as (
    select j.id
      from public.velto_jobs j
     where j.status in ('queued', 'running')
       and j.attempts >= j.max_attempts
       and (
         j.status = 'queued'
         or j.lease_expires_at is null
         or j.lease_expires_at <= now()
       )
       and j.updated_at <= now() - make_interval(mins => v_stale_minutes)
     order by j.updated_at asc
     for update skip locked
     limit v_limit
  ), updated as (
    update public.velto_jobs j
       set status = 'failed',
           error_code = coalesce(j.error_code, 'RECONCILIATION_ATTEMPTS_EXHAUSTED'),
           error_message = coalesce(
             j.error_message,
             'Job exhausted all attempts and was closed by financial reconciliation.'
           ),
           lease_owner = null,
           lease_expires_at = null,
           completed_at = coalesce(j.completed_at, now()),
           updated_at = now()
      from candidates c
     where j.id = c.id
    returning j.id
  )
  select count(*) into v_jobs_failed from updated;

  v_expire_result := public.velto_credit_expire_reservations(null, v_limit);

  return jsonb_build_object(
    'source', v_source,
    'settledDispatchedCount', v_settled_count,
    'settledDispatchedCredits', v_settled_credits,
    'settlementErrors', v_settlement_errors,
    'staleJobsFailed', v_jobs_failed,
    'expiredCount', coalesce((v_expire_result->>'expiredCount')::integer, 0),
    'expiredCredits', coalesce((v_expire_result->>'expiredCredits')::bigint, 0),
    'completedAt', now()
  );
end;
$$;

revoke all on function public.velto_credit_expire_reservations(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.velto_credit_mark_provider_dispatch(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.velto_fin_reconcile(integer, integer, text)
  from public, anon, authenticated;

grant execute on function public.velto_credit_expire_reservations(uuid, integer)
  to service_role;
grant execute on function public.velto_credit_mark_provider_dispatch(uuid, uuid, text, jsonb)
  to service_role;
grant execute on function public.velto_fin_reconcile(integer, integer, text)
  to service_role;

commit;
