-- SCALE-P1 hardening — worker registry, queue health and scale-out telemetry.
-- Apply after 20260730_scale_p1_job_queue.sql.

create table if not exists public.velto_workers (
  worker_id text primary key,
  hostname text not null,
  process_id integer,
  status text not null default 'starting'
    check (status in ('starting', 'idle', 'busy', 'stopping', 'stopped')),
  active_job_id uuid references public.velto_jobs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  stopped_at timestamptz
);

create index if not exists velto_workers_last_seen_idx
  on public.velto_workers (last_seen_at desc);

alter table public.velto_workers enable row level security;
revoke all on public.velto_workers from public, anon, authenticated;
grant all on public.velto_workers to service_role;

create or replace function public.velto_worker_heartbeat(
  p_worker_id text,
  p_hostname text,
  p_process_id integer,
  p_status text,
  p_active_job_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.velto_workers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker public.velto_workers;
  v_status text := lower(trim(coalesce(p_status, 'idle')));
begin
  if nullif(trim(p_worker_id), '') is null then
    raise exception 'worker id is required' using errcode = '22023';
  end if;

  if v_status not in ('starting', 'idle', 'busy', 'stopping', 'stopped') then
    raise exception 'unsupported worker status: %', v_status using errcode = '22023';
  end if;

  insert into public.velto_workers (
    worker_id,
    hostname,
    process_id,
    status,
    active_job_id,
    metadata,
    started_at,
    last_seen_at,
    stopped_at
  )
  values (
    trim(p_worker_id),
    coalesce(nullif(trim(p_hostname), ''), 'unknown'),
    p_process_id,
    v_status,
    p_active_job_id,
    coalesce(p_metadata, '{}'::jsonb),
    now(),
    now(),
    case when v_status = 'stopped' then now() else null end
  )
  on conflict (worker_id) do update
    set hostname = excluded.hostname,
        process_id = excluded.process_id,
        status = excluded.status,
        active_job_id = excluded.active_job_id,
        metadata = excluded.metadata,
        last_seen_at = now(),
        stopped_at = case
          when excluded.status = 'stopped' then now()
          else null
        end
  returning * into v_worker;

  return v_worker;
end;
$$;

create or replace function public.velto_worker_stop(
  p_worker_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.velto_workers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker public.velto_workers;
begin
  update public.velto_workers
     set status = 'stopped',
         active_job_id = null,
         metadata = coalesce(p_metadata, metadata),
         last_seen_at = now(),
         stopped_at = now()
   where worker_id = trim(p_worker_id)
  returning * into v_worker;

  if not found then
    raise exception 'Worker was not found.' using errcode = 'P0002';
  end if;

  return v_worker;
end;
$$;

create or replace function public.velto_job_queue_health(
  p_worker_stale_seconds integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stale_seconds integer := greatest(15, least(coalesce(p_worker_stale_seconds, 90), 3600));
  v_queued integer;
  v_running integer;
  v_succeeded_last_hour integer;
  v_failed_last_hour integer;
  v_cancelled_last_hour integer;
  v_oldest_queued_seconds numeric;
  v_expired_leases integer;
  v_active_workers integer;
  v_stale_workers integer;
  v_healthy boolean;
begin
  select count(*)::integer into v_queued
    from public.velto_jobs
   where status = 'queued';

  select count(*)::integer into v_running
    from public.velto_jobs
   where status = 'running';

  select count(*)::integer into v_succeeded_last_hour
    from public.velto_jobs
   where status = 'succeeded'
     and completed_at >= now() - interval '1 hour';

  select count(*)::integer into v_failed_last_hour
    from public.velto_jobs
   where status = 'failed'
     and completed_at >= now() - interval '1 hour';

  select count(*)::integer into v_cancelled_last_hour
    from public.velto_jobs
   where status = 'cancelled'
     and completed_at >= now() - interval '1 hour';

  select extract(epoch from (now() - min(created_at)))
    into v_oldest_queued_seconds
    from public.velto_jobs
   where status = 'queued';

  select count(*)::integer into v_expired_leases
    from public.velto_jobs
   where status = 'running'
     and lease_expires_at is not null
     and lease_expires_at <= now();

  select count(*)::integer into v_active_workers
    from public.velto_workers
   where status in ('starting', 'idle', 'busy')
     and last_seen_at > now() - make_interval(secs => v_stale_seconds);

  select count(*)::integer into v_stale_workers
    from public.velto_workers
   where status not in ('stopped')
     and last_seen_at <= now() - make_interval(secs => v_stale_seconds);

  v_healthy :=
    v_expired_leases = 0
    and (
      (v_queued = 0 and v_running = 0)
      or v_active_workers > 0
    );

  return jsonb_build_object(
    'checkedAt', now(),
    'queued', v_queued,
    'running', v_running,
    'succeededLastHour', v_succeeded_last_hour,
    'failedLastHour', v_failed_last_hour,
    'cancelledLastHour', v_cancelled_last_hour,
    'oldestQueuedSeconds', case
      when v_oldest_queued_seconds is null then null
      else floor(v_oldest_queued_seconds)::integer
    end,
    'expiredLeases', v_expired_leases,
    'activeWorkers', v_active_workers,
    'staleWorkers', v_stale_workers,
    'healthy', v_healthy
  );
end;
$$;

revoke all on function public.velto_worker_heartbeat(
  text, text, integer, text, uuid, jsonb
) from public, anon, authenticated;
revoke all on function public.velto_worker_stop(text, jsonb)
  from public, anon, authenticated;
revoke all on function public.velto_job_queue_health(integer)
  from public, anon, authenticated;

grant execute on function public.velto_worker_heartbeat(
  text, text, integer, text, uuid, jsonb
) to service_role;
grant execute on function public.velto_worker_stop(text, jsonb)
  to service_role;
grant execute on function public.velto_job_queue_health(integer)
  to service_role;
