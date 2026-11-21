-- CANCEL-P1 — Owner-scoped durable job cancellation
-- Apply after 20260730_scale_p1_job_queue.sql.

create or replace function public.velto_job_cancel(
  p_job_id uuid,
  p_user_id uuid,
  p_reason text default 'user_requested',
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
  select *
    into v_job
    from public.velto_jobs
   where id = p_job_id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception 'JOB_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_job.status in ('succeeded', 'failed', 'cancelled') then
    return v_job;
  end if;

  update public.velto_jobs
     set status = 'cancelled',
         result = coalesce(result, '{}'::jsonb)
           || coalesce(p_result, '{}'::jsonb)
           || jsonb_build_object(
                'cancelledBy', 'user',
                'cancelledAt', now(),
                'cancelReason', coalesce(nullif(trim(p_reason), ''), 'user_requested')
              ),
         error_code = 'USER_CANCELLED',
         error_message = coalesce(nullif(trim(p_reason), ''), 'User cancelled the job.'),
         lease_owner = null,
         lease_expires_at = null,
         completed_at = now(),
         updated_at = now()
   where id = p_job_id
     and user_id = p_user_id
     and status in ('queued', 'running')
  returning * into v_job;

  if not found then
    select * into v_job
      from public.velto_jobs
     where id = p_job_id
       and user_id = p_user_id;
  end if;

  return v_job;
end;
$$;

revoke all on function public.velto_job_cancel(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.velto_job_cancel(uuid, uuid, text, jsonb)
  to service_role;
