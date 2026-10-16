begin;

alter table public.velto_jobs drop constraint if exists velto_jobs_job_type_check;
alter table public.velto_jobs add constraint velto_jobs_job_type_check
  check (job_type in ('runtime_probe', 'video_reconcile', 'creator_export', 'creator_final_export'));

create table public.velto_creator_final_export_runs (
  job_id uuid primary key references public.velto_jobs(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  project_id uuid not null references public.velto_projects(id) on delete restrict,
  project_updated_at timestamptz not null,
  credit_reservation_id uuid not null references public.velto_credit_reservations(id) on delete restrict,
  production_signature text not null,
  production_signature_sha256 text not null check (production_signature_sha256 ~ '^[0-9a-f]{64}$'),
  manifest jsonb not null,
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  render_payload_sha256 text not null check (render_payload_sha256 ~ '^[0-9a-f]{64}$'),
  state text not null default 'queued' check (state in ('queued','rendering','uploaded','installed','stale','failed')),
  storage_admission_id uuid references public.velto_storage_admissions(id) on delete restrict,
  storage_bucket text,
  storage_path text,
  public_url text,
  size_bytes bigint check (size_bytes is null or size_bytes > 0),
  output_sha256 text check (output_sha256 is null or output_sha256 ~ '^[0-9a-f]{64}$'),
  output jsonb,
  render_lease_expires_at timestamptz,
  installed_project_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, project_id, production_signature_sha256),
  unique (storage_bucket, storage_path),
  check (jsonb_typeof(manifest) = 'object')
);

alter table public.velto_creator_final_export_runs enable row level security;
revoke all on table public.velto_creator_final_export_runs from public, anon, authenticated;
grant all on table public.velto_creator_final_export_runs to service_role;

create or replace function public.velto_enqueue_creator_final_export(
  p_owner_user_id uuid, p_project_id uuid, p_expected_updated_at timestamptz,
  p_production_signature text, p_production_signature_sha256 text,
  p_manifest jsonb, p_manifest_sha256 text, p_render_payload_sha256 text,
  p_payload jsonb
) returns public.velto_jobs
language plpgsql security invoker set search_path = '' as $$
declare v_project public.velto_projects; v_job public.velto_jobs; v_key text;
  v_credit_reservation_id uuid;
begin
  if p_expected_updated_at is null or coalesce(trim(p_production_signature), '') = ''
      or p_production_signature_sha256 !~ '^[0-9a-f]{64}$'
      or p_manifest_sha256 !~ '^[0-9a-f]{64}$' or p_render_payload_sha256 !~ '^[0-9a-f]{64}$'
      or jsonb_typeof(p_manifest) is distinct from 'object' or jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'CREATOR_FINAL_EXPORT_INPUT_INVALID';
  end if;
  select * into v_project from public.velto_projects
   where id = p_project_id and owner_user_id = p_owner_user_id for share;
  if not found or v_project.flow_type is distinct from 'creator_lab' then
    raise exception 'CREATOR_FINAL_EXPORT_PROJECT_NOT_OWNED';
  end if;
  if v_project.updated_at is distinct from p_expected_updated_at then
    raise exception 'CREATOR_FINAL_EXPORT_PROJECT_STALE';
  end if;
  begin v_credit_reservation_id := nullif(p_payload->>'creditReservationId','')::uuid;
  exception when others then raise exception 'CREATOR_FINAL_EXPORT_CREDIT_RESERVATION_INVALID'; end;
  if v_credit_reservation_id is null or not exists (
    select 1 from public.velto_credit_reservations r where r.id=v_credit_reservation_id
      and r.user_id=p_owner_user_id and r.status='reserved' and r.operation_type='creator_export'
  ) then raise exception 'CREATOR_FINAL_EXPORT_CREDIT_RESERVATION_INVALID'; end if;
  v_key := 'creator-final-export:' || p_project_id::text || ':' || p_production_signature_sha256;
  select * into v_job from public.velto_jobs
   where owner_key = p_owner_user_id::text and idempotency_key = v_key limit 1;
  if found then return v_job; end if;
  insert into public.velto_jobs(user_id, project_id, job_type, priority, payload, max_attempts, idempotency_key)
  values (p_owner_user_id, p_project_id::text, 'creator_final_export', 200,
    p_payload || jsonb_build_object('productionSignatureSha256', p_production_signature_sha256,
      'manifestSha256', p_manifest_sha256, 'renderPayloadSha256', p_render_payload_sha256), 20, v_key)
  returning * into v_job;
  insert into public.velto_creator_final_export_runs(job_id, owner_user_id, project_id, project_updated_at,credit_reservation_id,
    production_signature, production_signature_sha256, manifest, manifest_sha256, render_payload_sha256)
  values (v_job.id, p_owner_user_id, p_project_id, p_expected_updated_at,v_credit_reservation_id,p_production_signature,
    p_production_signature_sha256, p_manifest, p_manifest_sha256, p_render_payload_sha256);
  return v_job;
exception when unique_violation then
  select * into v_job from public.velto_jobs
   where owner_key = p_owner_user_id::text and idempotency_key = v_key limit 1;
  if not found then raise; end if;
  return v_job;
end; $$;

create or replace function public.velto_claim_creator_final_export_render(
  p_job_id uuid, p_owner_user_id uuid, p_manifest_sha256 text,
  p_render_payload_sha256 text, p_storage_admission_id uuid
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_run public.velto_creator_final_export_runs; v_now timestamptz := clock_timestamp();
begin
  select * into v_run from public.velto_creator_final_export_runs where job_id = p_job_id for update;
  if not found or v_run.owner_user_id is distinct from p_owner_user_id
      or v_run.manifest_sha256 is distinct from p_manifest_sha256
      or v_run.render_payload_sha256 is distinct from p_render_payload_sha256 then
    raise exception 'CREATOR_FINAL_EXPORT_PROVENANCE_INVALID';
  end if;
  if v_run.state in ('uploaded','installed','stale') then return jsonb_build_object('status', v_run.state); end if;
  if v_run.state = 'rendering' then
    return jsonb_build_object('status', 'rendering', 'leaseExpired', v_run.render_lease_expires_at <= v_now);
  end if;
  if not exists (select 1 from public.velto_storage_admissions a where a.id = p_storage_admission_id
      and a.owner_user_id = p_owner_user_id and a.project_reference = v_run.project_id::text
      and a.purpose = 'final_movie_export' and a.media_kind = 'video') then
    raise exception 'CREATOR_FINAL_EXPORT_ADMISSION_INVALID';
  end if;
  update public.velto_creator_final_export_runs set state = 'rendering', storage_admission_id = p_storage_admission_id,
    render_lease_expires_at = v_now + interval '15 minutes', updated_at = v_now where job_id = p_job_id;
  perform public.velto_credit_mark_provider_dispatch(v_run.owner_user_id,v_run.credit_reservation_id,p_job_id::text,
    jsonb_build_object('creatorFinalExportJobId',p_job_id,'renderAcceptedAt',v_now));
  return jsonb_build_object('status', 'claimed');
end; $$;

create or replace function public.velto_heartbeat_creator_final_export_render(
  p_job_id uuid, p_owner_user_id uuid, p_manifest_sha256 text,
  p_render_payload_sha256 text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_run public.velto_creator_final_export_runs; v_now timestamptz := clock_timestamp();
begin
  select * into v_run from public.velto_creator_final_export_runs where job_id=p_job_id for update;
  if not found or v_run.owner_user_id is distinct from p_owner_user_id
      or v_run.manifest_sha256 is distinct from p_manifest_sha256
      or v_run.render_payload_sha256 is distinct from p_render_payload_sha256
      or v_run.state is distinct from 'rendering' then
    raise exception 'CREATOR_FINAL_EXPORT_RENDER_LEASE_INVALID';
  end if;
  update public.velto_creator_final_export_runs set render_lease_expires_at=v_now+interval '15 minutes',
    updated_at=v_now where job_id=p_job_id;
  return jsonb_build_object('status','rendering','leaseExpiresAt',v_now+interval '15 minutes');
end; $$;

create or replace function public.velto_record_creator_final_export_upload(
  p_job_id uuid, p_manifest_sha256 text, p_render_payload_sha256 text,
  p_storage_bucket text, p_storage_path text, p_public_url text,
  p_size_bytes bigint, p_output_sha256 text, p_output jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_run public.velto_creator_final_export_runs;
begin
  select * into v_run from public.velto_creator_final_export_runs where job_id = p_job_id for update;
  if not found or v_run.manifest_sha256 is distinct from p_manifest_sha256
      or v_run.render_payload_sha256 is distinct from p_render_payload_sha256
      or v_run.state not in ('rendering','uploaded') then raise exception 'CREATOR_FINAL_EXPORT_PROVENANCE_INVALID'; end if;
  if p_storage_bucket is distinct from 'movies'
      or p_storage_path is distinct from ('creator/' || v_run.owner_user_id::text || '/final/' || v_run.project_id::text || '/jobs/' || p_job_id::text || '.mp4')
      or coalesce(trim(p_public_url),'') = '' or p_size_bytes < 1 or p_output_sha256 !~ '^[0-9a-f]{64}$'
      or jsonb_typeof(p_output) is distinct from 'object' then
    raise exception 'CREATOR_FINAL_EXPORT_OBJECT_INVALID';
  end if;
  if v_run.state = 'uploaded' and (v_run.storage_path, v_run.size_bytes, v_run.output_sha256)
      is distinct from (p_storage_path, p_size_bytes, p_output_sha256) then raise exception 'CREATOR_FINAL_EXPORT_UPLOAD_CONFLICT'; end if;
  update public.velto_creator_final_export_runs set state='uploaded', storage_bucket=p_storage_bucket,
    storage_path=p_storage_path, public_url=p_public_url, size_bytes=p_size_bytes, output_sha256=p_output_sha256,
    output=p_output,
    render_lease_expires_at=null, updated_at=clock_timestamp() where job_id=p_job_id;
  return jsonb_build_object('status','uploaded');
end; $$;

create or replace function public.velto_finalize_creator_final_export_admission(
  p_job_id uuid, p_owner_user_id uuid, p_manifest_sha256 text
) returns text
language plpgsql security invoker set search_path = '' as $$
declare v_run public.velto_creator_final_export_runs;
begin
  select * into v_run from public.velto_creator_final_export_runs where job_id=p_job_id for update;
  if not found or v_run.owner_user_id is distinct from p_owner_user_id
      or v_run.manifest_sha256 is distinct from p_manifest_sha256
      or v_run.state is distinct from 'rendering' or v_run.storage_admission_id is null then
    raise exception 'CREATOR_FINAL_EXPORT_ADMISSION_PROVENANCE_INVALID';
  end if;
  update public.velto_storage_admissions set consumed_at=coalesce(consumed_at,clock_timestamp()),
    consumption_started_at=null,consumption_token=null
   where id=v_run.storage_admission_id and owner_user_id=v_run.owner_user_id
     and project_reference=v_run.project_id::text and purpose='final_movie_export' and media_kind='video';
  if not found then raise exception 'CREATOR_FINAL_EXPORT_ADMISSION_INVALID'; end if;
  return 'consumed';
end; $$;

create or replace function public.velto_install_creator_final_export(
  p_job_id uuid, p_exported_movie_result jsonb, p_references jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_run public.velto_creator_final_export_runs; v_project public.velto_projects;
  v_asset public.velto_media_assets; v_installed_at timestamptz := clock_timestamp();
begin
  if jsonb_typeof(p_exported_movie_result) is distinct from 'object'
      or jsonb_typeof(p_references) is distinct from 'array' then
    raise exception 'CREATOR_FINAL_EXPORT_INSTALL_INPUT_INVALID';
  end if;
  select * into v_run from public.velto_creator_final_export_runs where job_id = p_job_id for update;
  if not found or v_run.state not in ('uploaded','installed','stale') or v_run.storage_bucket is null
      or v_run.storage_path is null or v_run.public_url is null or v_run.size_bytes is null then
    raise exception 'CREATOR_FINAL_EXPORT_NOT_UPLOADED';
  end if;
  select * into v_project from public.velto_projects
   where id=v_run.project_id and owner_user_id=v_run.owner_user_id for update;
  if not found then raise exception 'CREATOR_FINAL_EXPORT_PROJECT_NOT_OWNED'; end if;
  if v_run.state='stale' then
    return jsonb_build_object('status','stale','projectUpdatedAt',v_project.updated_at);
  end if;
  if v_run.state='installed' then
    if v_project.exported_movie_url is distinct from v_run.public_url
        or v_project.export_signature is distinct from v_run.production_signature then
      raise exception 'CREATOR_FINAL_EXPORT_INSTALL_CONFLICT';
    end if;
    return jsonb_build_object('status','already_installed','projectUpdatedAt',v_run.installed_project_updated_at);
  end if;
  if v_project.updated_at is distinct from v_run.project_updated_at then
    update public.velto_creator_final_export_runs set state='stale', updated_at=v_installed_at where job_id=p_job_id;
    return jsonb_build_object('status','stale','projectUpdatedAt',v_project.updated_at);
  end if;
  if not exists (select 1 from public.velto_storage_admissions a where a.id=v_run.storage_admission_id
      and a.owner_user_id=v_run.owner_user_id and a.project_reference=v_run.project_id::text
      and a.purpose='final_movie_export' and a.consumed_at is not null) then
    raise exception 'CREATOR_FINAL_EXPORT_ADMISSION_NOT_CONSUMED';
  end if;
  select * into v_asset from public.velto_media_assets
   where bucket=v_run.storage_bucket and storage_path=v_run.storage_path for update;
  if found then
    if v_asset.owner_user_id is distinct from v_run.owner_user_id or v_asset.public_url is distinct from v_run.public_url
        or v_asset.media_kind is distinct from 'final_video' or v_asset.mime_type is distinct from 'video/mp4'
        or v_asset.size_bytes is distinct from v_run.size_bytes or v_asset.lifecycle_state is distinct from 'active'
        or v_asset.metadata->>'projectId' is distinct from v_run.project_id::text
        or v_asset.metadata->>'finalExportJobId' is distinct from p_job_id::text then
      raise exception 'CREATOR_FINAL_EXPORT_ASSET_CONFLICT';
    end if;
  else
    insert into public.velto_media_assets(owner_user_id,bucket,storage_path,public_url,media_kind,mime_type,size_bytes,lifecycle_state,metadata)
    values(v_run.owner_user_id,v_run.storage_bucket,v_run.storage_path,v_run.public_url,'final_video','video/mp4',v_run.size_bytes,'active',
      jsonb_build_object('projectId',v_run.project_id::text,'finalExportJobId',p_job_id::text,
        'productionSignatureSha256',v_run.production_signature_sha256,'manifestSha256',v_run.manifest_sha256,
        'outputSha256',v_run.output_sha256)) returning * into v_asset;
  end if;
  if not exists (select 1 from jsonb_to_recordset(p_references) r(url text,reference_type text,reference_key text)
      where r.url=v_run.public_url and r.reference_type='final_video' and r.reference_key='project:final-video') then
    raise exception 'CREATOR_FINAL_EXPORT_REFERENCE_REQUIRED';
  end if;
  update public.velto_projects set exported_movie_url=v_run.public_url,
    exported_movie_result=p_exported_movie_result, export_signature=v_run.production_signature, updated_at=v_installed_at
   where id=v_run.project_id and owner_user_id=v_run.owner_user_id and updated_at=v_run.project_updated_at
   returning * into v_project;
  if not found then raise exception 'CREATOR_FINAL_EXPORT_PROJECT_CAS_FAILED'; end if;
  delete from public.velto_media_asset_references where project_id=v_run.project_id and owner_user_id=v_run.owner_user_id;
  insert into public.velto_media_asset_references(owner_user_id,asset_id,project_id,reference_type,reference_key)
  select distinct v_run.owner_user_id,a.id,v_run.project_id,r.reference_type,r.reference_key
   from jsonb_to_recordset(p_references) r(url text,reference_type text,reference_key text)
   join public.velto_media_assets a on a.public_url=r.url and a.owner_user_id=v_run.owner_user_id and a.lifecycle_state='active'
   where r.reference_type in ('scene_image','scene_video','asset_history','narration_audio','dialogue_audio','thumbnail','final_video','other')
     and length(trim(r.reference_key))>0;
  update public.velto_creator_final_export_runs set state='installed',installed_project_updated_at=v_installed_at,
    updated_at=v_installed_at where job_id=p_job_id;
  return jsonb_build_object('status','installed','projectUpdatedAt',v_installed_at,'assetId',v_asset.id);
end; $$;

create or replace function public.velto_settle_creator_final_export_economics(
  p_attempt_key text, p_job_id uuid, p_asset_identity text,
  p_scene_count integer, p_output_bytes bigint
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_operation public.velto_creator_economic_operations; v_now timestamptz := clock_timestamp();
begin
  select * into v_operation from public.velto_creator_economic_operations
   where attempt_key=p_attempt_key for update;
  if not found or v_operation.operation_type is distinct from 'creator_export'
      or v_operation.provider is distinct from 'velto-export' then
    raise exception 'CREATOR_FINAL_EXPORT_ECONOMIC_OPERATION_INVALID';
  end if;
  if v_operation.state='provider_billed' then
    return jsonb_build_object('status','already_settled');
  end if;
  if v_operation.state not in ('reserved','dispatch_attempted','provider_accepted','application_failed_after_provider_cost') then
    raise exception 'CREATOR_FINAL_EXPORT_ECONOMIC_STATE_INVALID';
  end if;
  update public.velto_creator_economic_operations set state='provider_billed', export_id=p_job_id::text,
    billing_moment='render_completion', asset_identity=p_asset_identity,
    quantities=jsonb_build_object('sceneCount',greatest(coalesce(p_scene_count,0),0),
      'outputBytes',greatest(coalesce(p_output_bytes,0),0),'requestCount',1),
    cost_status='unknown', cost_reason='Railway runtime, Supabase storage, and egress rates are not approved.',
    completed_at=coalesce(completed_at,v_now), updated_at=v_now where attempt_key=p_attempt_key;
  return jsonb_build_object('status','settled');
end; $$;

revoke all on function public.velto_enqueue_creator_final_export(uuid,uuid,timestamptz,text,text,jsonb,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.velto_claim_creator_final_export_render(uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.velto_heartbeat_creator_final_export_render(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.velto_record_creator_final_export_upload(uuid,text,text,text,text,text,bigint,text,jsonb) from public,anon,authenticated;
revoke all on function public.velto_finalize_creator_final_export_admission(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.velto_install_creator_final_export(uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.velto_settle_creator_final_export_economics(text,uuid,text,integer,bigint) from public,anon,authenticated;
grant execute on function public.velto_enqueue_creator_final_export(uuid,uuid,timestamptz,text,text,jsonb,text,text,jsonb) to service_role;
grant execute on function public.velto_claim_creator_final_export_render(uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.velto_heartbeat_creator_final_export_render(uuid,uuid,text,text) to service_role;
grant execute on function public.velto_record_creator_final_export_upload(uuid,text,text,text,text,text,bigint,text,jsonb) to service_role;
grant execute on function public.velto_finalize_creator_final_export_admission(uuid,uuid,text) to service_role;
grant execute on function public.velto_install_creator_final_export(uuid,jsonb,jsonb) to service_role;
grant execute on function public.velto_settle_creator_final_export_economics(text,uuid,text,integer,bigint) to service_role;

commit;
