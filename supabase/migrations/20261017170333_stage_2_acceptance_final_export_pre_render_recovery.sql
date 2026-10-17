begin;

create or replace function public.velto_reject_creator_final_export_pre_render(
  p_job_id uuid,
  p_owner_user_id uuid,
  p_manifest_sha256 text,
  p_render_payload_sha256 text,
  p_worker_id text,
  p_reason text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run public.velto_creator_final_export_runs;
  v_job public.velto_jobs;
  v_admission_id uuid;
  v_economic_attempt_key text;
begin
  if p_reason is distinct from 'media_identity_invalid' or nullif(trim(p_worker_id), '') is null then
    raise exception 'CREATOR_FINAL_EXPORT_PRE_RENDER_REASON_INVALID';
  end if;

  select * into v_run
    from public.velto_creator_final_export_runs
   where job_id = p_job_id
   for update;

  if not found or v_run.owner_user_id is distinct from p_owner_user_id
      or v_run.manifest_sha256 is distinct from p_manifest_sha256
      or v_run.render_payload_sha256 is distinct from p_render_payload_sha256 then
    raise exception 'CREATOR_FINAL_EXPORT_PROVENANCE_INVALID';
  end if;

  if v_run.state = 'failed' then
    return jsonb_build_object('status', 'already_failed');
  end if;
  if v_run.state is distinct from 'queued'
      or v_run.storage_bucket is not null or v_run.storage_path is not null
      or v_run.public_url is not null or v_run.output is not null
      or v_run.render_lease_expires_at is not null then
    raise exception 'CREATOR_FINAL_EXPORT_PRE_RENDER_STATE_INVALID';
  end if;

  select * into v_job from public.velto_jobs where id = p_job_id for update;
  if not found or v_job.user_id is distinct from p_owner_user_id
      or v_job.job_type is distinct from 'creator_final_export'
      or v_job.status is distinct from 'running'
      or v_job.lease_owner is distinct from trim(p_worker_id)
      or v_job.lease_expires_at is null or v_job.lease_expires_at <= clock_timestamp() then
    raise exception 'CREATOR_FINAL_EXPORT_JOB_INVALID';
  end if;

  begin
    v_admission_id := nullif(v_job.payload->>'storageAdmissionId', '')::uuid;
  exception when others then
    raise exception 'CREATOR_FINAL_EXPORT_ADMISSION_INVALID';
  end;
  if v_admission_id is null then raise exception 'CREATOR_FINAL_EXPORT_ADMISSION_INVALID'; end if;

  update public.velto_storage_admissions
     set consumption_started_at = null, consumption_token = null
   where id = v_admission_id and owner_user_id = p_owner_user_id
     and project_reference = v_run.project_id::text
     and purpose = 'final_movie_export' and media_kind = 'video'
     and consumed_at is null;
  if not found then raise exception 'CREATOR_FINAL_EXPORT_ADMISSION_INVALID'; end if;

  perform public.velto_credit_release(
    p_owner_user_id,
    v_run.credit_reservation_id,
    'creator_final_export_pre_render_rejected',
    jsonb_build_object('jobId', p_job_id, 'failureStage', 'pre_render_validation')
  );

  v_economic_attempt_key := nullif(v_job.payload->>'economicAttemptKey', '');
  if v_economic_attempt_key is null then
    raise exception 'CREATOR_FINAL_EXPORT_ECONOMIC_OPERATION_INVALID';
  end if;
  update public.velto_creator_economic_operations
     set state = 'released', ambiguity_reason = p_reason,
         failed_at = coalesce(failed_at, clock_timestamp()), updated_at = clock_timestamp()
   where attempt_key = v_economic_attempt_key and user_id = p_owner_user_id
     and project_id = v_run.project_id::text and operation_type = 'creator_export'
     and state = 'reserved';
  if not found then raise exception 'CREATOR_FINAL_EXPORT_ECONOMIC_OPERATION_INVALID'; end if;

  update public.velto_creator_final_export_runs
     set state = 'failed', render_lease_expires_at = null, updated_at = clock_timestamp()
   where job_id = p_job_id;
  return jsonb_build_object('status', 'failed', 'renderAccepted', false);
end;
$$;

revoke all on function public.velto_reject_creator_final_export_pre_render(uuid,uuid,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.velto_reject_creator_final_export_pre_render(uuid,uuid,text,text,text,text)
  to service_role;

commit;
