-- SCALE-P1 — Durable Postgres job queue for Velto Studio
-- Apply once in the Supabase SQL Editor before starting the worker service.

create extension if not exists pgcrypto;

create table if not exists public.velto_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  owner_key text generated always as (coalesce(user_id::text, 'system')) stored,
  project_id text,
  job_type text not null
    check (job_type in ('runtime_probe', 'video_reconcile')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  priority integer not null default 100
    check (priority between 0 and 1000),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error_code text,
  error_message text,
  attempts integer not null default 0
    check (attempts >= 0),
  max_attempts integer not null default 5
    check (max_attempts between 1 and 120),
  available_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  idempotency_key text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists velto_jobs_claim_idx
  on public.velto_jobs (status, available_at, priority desc, created_at)
  where status in ('queued', 'running');

create index if not exists velto_jobs_user_created_idx
  on public.velto_jobs (user_id, created_at desc);

create unique index if not exists velto_jobs_idempotency_idx
  on public.velto_jobs (owner_key, idempotency_key)
  where idempotency_key is not null;

alter table public.velto_jobs enable row level security;

drop policy if exists velto_jobs_select_own on public.velto_jobs;
create policy velto_jobs_select_own
  on public.velto_jobs
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.velto_jobs from anon;
grant select on public.velto_jobs to authenticated;
grant all on public.velto_jobs to service_role;

create or replace function public.velto_job_enqueue(
  p_job_type text,
  p_payload jsonb,
  p_user_id uuid default null,
  p_project_id text default null,
  p_priority integer default 100,
  p_max_attempts integer default 5,
  p_available_at timestamptz default now(),
  p_idempotency_key text default null
)
returns public.velto_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.velto_jobs;
  v_idempotency_key text;
begin
  if p_job_type not in ('runtime_probe', 'video_reconcile') then
    raise exception 'Unsupported job type: %', p_job_type
      using errcode = '22023';
  end if;

  v_idempotency_key := nullif(trim(p_idempotency_key), '');

  if v_idempotency_key is not null then
    select *
      into v_job
      from public.velto_jobs
     where owner_key = coalesce(p_user_id::text, 'system')
       and idempotency_key = v_idempotency_key
     limit 1;

    if found then
      return v_job;
    end if;
  end if;

  begin
    insert into public.velto_jobs (
      user_id,
      project_id,
      job_type,
      priority,
      payload,
      max_attempts,
      available_at,
      idempotency_key
    )
    values (
      p_user_id,
      nullif(trim(p_project_id), ''),
      p_job_type,
      greatest(0, least(coalesce(p_priority, 100), 1000)),
      coalesce(p_payload, '{}'::jsonb),
      greatest(1, least(coalesce(p_max_attempts, 5), 120)),
      coalesce(p_available_at, now()),
      v_idempotency_key
    )
    returning * into v_job;

    return v_job;
  exception
    when unique_violation then
      select *
        into v_job
        from public.velto_jobs
       where owner_key = coalesce(p_user_id::text, 'system')
         and idempotency_key = v_idempotency_key
       limit 1;

      if not found then
        raise;
      end if;

      return v_job;
  end;
end;
$$;

create or replace function public.velto_job_claim(
  p_worker_id text,
  p_lease_seconds integer default 60
)
returns setof public.velto_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(p_worker_id), '') is null then
    raise exception 'worker id is required'
      using errcode = '22023';
  end if;

  return query
  with candidate as (
    select j.id
      from public.velto_jobs j
     where (
       j.status = 'queued'
       or (
         j.status = 'running'
         and j.lease_expires_at is not null
         and j.lease_expires_at <= now()
       )
     )
       and j.available_at <= now()
       and j.attempts < j.max_attempts
     order by j.priority desc, j.created_at asc
     for update skip locked
     limit 1
  )
  update public.velto_jobs j
     set status = 'running',
         attempts = j.attempts + 1,
         lease_owner = trim(p_worker_id),
         lease_expires_at =
           now() + make_interval(secs => greatest(15, least(coalesce(p_lease_seconds, 60), 900))),
         started_at = coalesce(j.started_at, now()),
         updated_at = now()
    from candidate c
   where j.id = c.id
  returning j.*;
end;
$$;

create or replace function public.velto_job_heartbeat(
  p_job_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 60
)
returns public.velto_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.velto_jobs;
begin
  update public.velto_jobs
     set lease_expires_at =
           now() + make_interval(secs => greatest(15, least(coalesce(p_lease_seconds, 60), 900))),
         updated_at = now()
   where id = p_job_id
     and status = 'running'
     and lease_owner = trim(p_worker_id)
  returning * into v_job;

  if not found then
    raise exception 'Job lease was not found.'
      using errcode = 'P0002';
  end if;

  return v_job;
end;
$$;

create or replace function public.velto_job_complete(
  p_job_id uuid,
  p_worker_id text,
  p_result jsonb default '{}'::jsonb
)
returns public.velto_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.velto_jobs;
begin
  update public.velto_jobs
     set status = 'succeeded',
         result = coalesce(p_result, '{}'::jsonb),
         error_code = null,
         error_message = null,
         lease_owner = null,
         lease_expires_at = null,
         completed_at = now(),
         updated_at = now()
   where id = p_job_id
     and status = 'running'
     and lease_owner = trim(p_worker_id)
  returning * into v_job;

  if not found then
    raise exception 'Job lease was not found.'
      using errcode = 'P0002';
  end if;

  return v_job;
end;
$$;

create or replace function public.velto_job_reschedule(
  p_job_id uuid,
  p_worker_id text,
  p_delay_seconds integer default 5,
  p_reason text default null
)
returns public.velto_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.velto_jobs;
begin
  update public.velto_jobs
     set status = 'queued',
         available_at =
           now() + make_interval(secs => greatest(1, least(coalesce(p_delay_seconds, 5), 3600))),
         error_code = 'WAITING',
         error_message = nullif(trim(p_reason), ''),
         lease_owner = null,
         lease_expires_at = null,
         updated_at = now()
   where id = p_job_id
     and status = 'running'
     and lease_owner = trim(p_worker_id)
  returning * into v_job;

  if not found then
    raise exception 'Job lease was not found.'
      using errcode = 'P0002';
  end if;

  return v_job;
end;
$$;

create or replace function public.velto_job_fail(
  p_job_id uuid,
  p_worker_id text,
  p_error_code text,
  p_error_message text,
  p_retryable boolean default true,
  p_retry_delay_seconds integer default 15
)
returns public.velto_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.velto_jobs;
begin
  update public.velto_jobs
     set status =
           case
             when coalesce(p_retryable, true) and attempts < max_attempts
               then 'queued'
             else 'failed'
           end,
         available_at =
           case
             when coalesce(p_retryable, true) and attempts < max_attempts
               then now() + make_interval(
                 secs => greatest(1, least(coalesce(p_retry_delay_seconds, 15), 3600))
               )
             else available_at
           end,
         error_code = nullif(trim(p_error_code), ''),
         error_message = nullif(trim(p_error_message), ''),
         lease_owner = null,
         lease_expires_at = null,
         completed_at =
           case
             when coalesce(p_retryable, true) and attempts < max_attempts
               then null
             else now()
           end,
         updated_at = now()
   where id = p_job_id
     and status = 'running'
     and lease_owner = trim(p_worker_id)
  returning * into v_job;

  if not found then
    raise exception 'Job lease was not found.'
      using errcode = 'P0002';
  end if;

  return v_job;
end;
$$;

revoke all on function public.velto_job_enqueue(
  text, jsonb, uuid, text, integer, integer, timestamptz, text
) from public, anon, authenticated;
revoke all on function public.velto_job_claim(text, integer)
  from public, anon, authenticated;
revoke all on function public.velto_job_heartbeat(uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.velto_job_complete(uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.velto_job_reschedule(uuid, text, integer, text)
  from public, anon, authenticated;
revoke all on function public.velto_job_fail(
  uuid, text, text, text, boolean, integer
) from public, anon, authenticated;

grant execute on function public.velto_job_enqueue(
  text, jsonb, uuid, text, integer, integer, timestamptz, text
) to service_role;
grant execute on function public.velto_job_claim(text, integer)
  to service_role;
grant execute on function public.velto_job_heartbeat(uuid, text, integer)
  to service_role;
grant execute on function public.velto_job_complete(uuid, text, jsonb)
  to service_role;
grant execute on function public.velto_job_reschedule(uuid, text, integer, text)
  to service_role;
grant execute on function public.velto_job_fail(
  uuid, text, text, text, boolean, integer
) to service_role;
