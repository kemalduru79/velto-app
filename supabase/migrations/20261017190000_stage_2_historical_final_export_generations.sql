begin;

alter table public.velto_creator_final_export_runs
  add column if not exists generation integer not null default 0 check (generation >= 0);

do $$
declare v_constraint text;
begin
  select c.conname into v_constraint
  from pg_catalog.pg_constraint c
  where c.conrelid = 'public.velto_creator_final_export_runs'::regclass
    and c.contype = 'u'
    and pg_catalog.pg_get_constraintdef(c.oid) = 'UNIQUE (owner_user_id, project_id, production_signature_sha256)';
  if v_constraint is not null then
    execute format('alter table public.velto_creator_final_export_runs drop constraint %I', v_constraint);
  end if;
end $$;

alter table public.velto_creator_final_export_runs
  add constraint velto_creator_final_export_runs_signature_generation_key
  unique (owner_user_id, project_id, production_signature_sha256, generation);

create table public.velto_creator_final_export_rearm_authorizations (
  predecessor_job_id uuid primary key references public.velto_creator_final_export_runs(job_id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  project_id uuid not null references public.velto_projects(id) on delete restrict,
  production_signature_sha256 text not null check (production_signature_sha256 ~ '^[0-9a-f]{64}$'),
  generation integer not null check (generation > 0),
  evidence_sha256 text not null check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  reason text not null,
  authorized_at timestamptz not null default now(),
  consumed_job_id uuid unique references public.velto_jobs(id) on delete restrict,
  consumed_at timestamptz,
  unique (owner_user_id, project_id, production_signature_sha256, generation),
  check ((consumed_job_id is null) = (consumed_at is null))
);
alter table public.velto_creator_final_export_rearm_authorizations enable row level security;
revoke all on table public.velto_creator_final_export_rearm_authorizations from public, anon, authenticated;
grant all on table public.velto_creator_final_export_rearm_authorizations to service_role;

create table public.velto_creator_final_export_recovery_evidence (
  job_id uuid primary key references public.velto_creator_final_export_runs(job_id) on delete restrict,
  evidence_sha256 text not null check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  nonbillable_verified boolean not null check (nonbillable_verified),
  verification_reason text not null,
  verified_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.velto_creator_final_export_recovery_evidence enable row level security;
revoke all on table public.velto_creator_final_export_recovery_evidence from public, anon, authenticated;
grant all on table public.velto_creator_final_export_recovery_evidence to service_role;

create or replace function public.velto_resolve_creator_final_export_generation(
  p_owner_user_id uuid, p_project_id uuid, p_production_signature_sha256 text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_run public.velto_creator_final_export_runs; v_auth public.velto_creator_final_export_rearm_authorizations;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_owner_user_id::text || ':' || p_project_id::text || ':' || p_production_signature_sha256, 0));
  select * into v_run from public.velto_creator_final_export_runs
   where owner_user_id=p_owner_user_id and project_id=p_project_id
     and production_signature_sha256=p_production_signature_sha256
   order by generation desc limit 1;
  if not found then return jsonb_build_object('generation',0,'status','new'); end if;
  select * into v_auth from public.velto_creator_final_export_rearm_authorizations
   where predecessor_job_id=v_run.job_id and generation=v_run.generation+1;
  if found then
    return jsonb_build_object('generation',v_auth.generation,'status',case when v_auth.consumed_job_id is null then 'authorized' else 'reused' end,
      'jobId',v_auth.consumed_job_id);
  end if;
  return jsonb_build_object('generation',v_run.generation,'status','reused','jobId',v_run.job_id);
end $$;

create or replace function public.velto_enqueue_creator_final_export_generation(
  p_owner_user_id uuid, p_project_id uuid, p_expected_updated_at timestamptz,
  p_production_signature text, p_production_signature_sha256 text,
  p_manifest jsonb, p_manifest_sha256 text, p_render_payload_sha256 text,
  p_generation integer, p_payload jsonb
) returns public.velto_jobs
language plpgsql security invoker set search_path = '' as $$
declare v_project public.velto_projects; v_job public.velto_jobs; v_auth public.velto_creator_final_export_rearm_authorizations;
  v_key text; v_credit_reservation_id uuid;
begin
  if p_generation is null or p_generation < 0 or p_expected_updated_at is null
      or coalesce(trim(p_production_signature),'')='' or p_production_signature_sha256 !~ '^[0-9a-f]{64}$'
      or p_manifest_sha256 !~ '^[0-9a-f]{64}$' or p_render_payload_sha256 !~ '^[0-9a-f]{64}$'
      or jsonb_typeof(p_manifest) is distinct from 'object' or jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'CREATOR_FINAL_EXPORT_INPUT_INVALID';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_owner_user_id::text || ':' || p_project_id::text || ':' || p_production_signature_sha256, 0));
  select * into v_project from public.velto_projects where id=p_project_id and owner_user_id=p_owner_user_id for share;
  if not found or v_project.flow_type is distinct from 'creator_lab' then raise exception 'CREATOR_FINAL_EXPORT_PROJECT_NOT_OWNED'; end if;
  if v_project.updated_at is distinct from p_expected_updated_at then raise exception 'CREATOR_FINAL_EXPORT_PROJECT_STALE'; end if;
  v_key := 'creator-final-export:' || p_project_id::text || ':' || p_production_signature_sha256
    || case when p_generation=0 then '' else ':generation:' || p_generation::text end;
  select * into v_job from public.velto_jobs where owner_key=p_owner_user_id::text and idempotency_key=v_key limit 1;
  if found then return v_job; end if;
  if p_generation > 0 then
    select a.* into v_auth from public.velto_creator_final_export_rearm_authorizations a
    join public.velto_creator_final_export_runs r on r.job_id=a.predecessor_job_id
    where a.owner_user_id=p_owner_user_id and a.project_id=p_project_id
      and a.production_signature_sha256=p_production_signature_sha256 and a.generation=p_generation
      and a.consumed_job_id is null and r.generation=p_generation-1 and r.state='failed' for update of a;
    if not found then raise exception 'CREATOR_FINAL_EXPORT_REARM_NOT_AUTHORIZED'; end if;
  elsif exists(select 1 from public.velto_creator_final_export_runs where owner_user_id=p_owner_user_id and project_id=p_project_id and production_signature_sha256=p_production_signature_sha256) then
    raise exception 'CREATOR_FINAL_EXPORT_GENERATION_CONFLICT';
  end if;
  begin v_credit_reservation_id := nullif(p_payload->>'creditReservationId','')::uuid;
  exception when others then raise exception 'CREATOR_FINAL_EXPORT_CREDIT_RESERVATION_INVALID'; end;
  if v_credit_reservation_id is null or not exists(select 1 from public.velto_credit_reservations r where r.id=v_credit_reservation_id
      and r.user_id=p_owner_user_id and r.status='reserved' and r.operation_type='creator_export') then
    raise exception 'CREATOR_FINAL_EXPORT_CREDIT_RESERVATION_INVALID';
  end if;
  insert into public.velto_jobs(user_id,project_id,job_type,priority,payload,max_attempts,idempotency_key)
  values(p_owner_user_id,p_project_id::text,'creator_final_export',200,p_payload || jsonb_build_object(
    'productionSignatureSha256',p_production_signature_sha256,'manifestSha256',p_manifest_sha256,
    'renderPayloadSha256',p_render_payload_sha256,'generation',p_generation),20,v_key) returning * into v_job;
  insert into public.velto_creator_final_export_runs(job_id,owner_user_id,project_id,project_updated_at,credit_reservation_id,
    production_signature,production_signature_sha256,manifest,manifest_sha256,render_payload_sha256,generation)
  values(v_job.id,p_owner_user_id,p_project_id,p_expected_updated_at,v_credit_reservation_id,p_production_signature,
    p_production_signature_sha256,p_manifest,p_manifest_sha256,p_render_payload_sha256,p_generation);
  if p_generation > 0 then
    update public.velto_creator_final_export_rearm_authorizations set consumed_job_id=v_job.id,consumed_at=clock_timestamp()
     where predecessor_job_id=v_auth.predecessor_job_id and consumed_job_id is null;
    if not found then raise exception 'CREATOR_FINAL_EXPORT_REARM_CONFLICT'; end if;
  end if;
  return v_job;
end $$;

revoke all on function public.velto_resolve_creator_final_export_generation(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.velto_enqueue_creator_final_export_generation(uuid,uuid,timestamptz,text,text,jsonb,text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.velto_resolve_creator_final_export_generation(uuid,uuid,text) to service_role;
grant execute on function public.velto_enqueue_creator_final_export_generation(uuid,uuid,timestamptz,text,text,jsonb,text,text,integer,jsonb) to service_role;

create or replace function public.velto_reconcile_incident_0e20dfd9_creator_final_export(
  p_owner_user_id uuid, p_expected_project_updated_at timestamptz,
  p_expected_production_signature_sha256 text, p_evidence_sha256 text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_job constant uuid := '0e20dfd9-0157-43a1-abe5-1752db2e36f1';
  v_project constant uuid := 'e572838e-98ab-42cd-92f4-bf56658cad77';
  v_run public.velto_creator_final_export_runs; v_queue public.velto_jobs;
  v_project_row public.velto_projects; v_reservation public.velto_credit_reservations;
  v_economic public.velto_creator_economic_operations; v_admission public.velto_storage_admissions;
  v_evidence public.velto_creator_final_export_recovery_evidence; v_storage_count bigint;
  v_attempt_key text; v_path text := 'creator/' || p_owner_user_id::text || '/final/' || v_project::text || '/jobs/' || v_job::text || '.mp4';
begin
  select * into v_run from public.velto_creator_final_export_runs where job_id=v_job for update;
  select * into v_queue from public.velto_jobs where id=v_job for update;
  select * into v_project_row from public.velto_projects where id=v_project and owner_user_id=p_owner_user_id for share;
  select * into v_evidence from public.velto_creator_final_export_recovery_evidence
   where job_id=v_job and evidence_sha256=p_evidence_sha256 and nonbillable_verified for share;
  if v_run.job_id is null or v_queue.id is null or v_project_row.id is null or v_evidence.job_id is null
      or v_run.owner_user_id is distinct from p_owner_user_id or v_run.project_id is distinct from v_project
      or v_run.project_updated_at is distinct from p_expected_project_updated_at
      or v_project_row.updated_at is distinct from p_expected_project_updated_at
      or v_run.production_signature_sha256 is distinct from p_expected_production_signature_sha256 then
    raise exception 'CREATOR_FINAL_EXPORT_INCIDENT_PROVENANCE_INVALID';
  end if;
  if exists(select 1 from public.velto_creator_final_export_rearm_authorizations where predecessor_job_id=v_job) then
    return jsonb_build_object('status','already_reconciled','generation',1);
  end if;
  if v_queue.status is distinct from 'failed' or v_queue.lease_owner is not null or v_queue.lease_expires_at is not null
      or v_run.state is distinct from 'rendering' or v_run.render_lease_expires_at is null
      or v_run.render_lease_expires_at >= clock_timestamp() or v_run.generation <> 0
      or v_run.storage_bucket is not null or v_run.storage_path is not null or v_run.public_url is not null
      or v_run.size_bytes is not null or v_run.output_sha256 is not null or v_run.output is not null
      or v_run.installed_project_updated_at is not null then
    raise exception 'CREATOR_FINAL_EXPORT_INCIDENT_STATE_AMBIGUOUS';
  end if;
  if v_project_row.exported_movie_url is not null and v_project_row.exported_movie_url like '%' || v_job::text || '%' then
    raise exception 'CREATOR_FINAL_EXPORT_INCIDENT_ALREADY_INSTALLED';
  end if;
  if exists(select 1 from public.velto_media_assets where bucket='movies' and storage_path=v_path)
      or exists(select 1 from public.velto_media_asset_references r join public.velto_media_assets a on a.id=r.asset_id
        where a.bucket='movies' and a.storage_path=v_path) then
    raise exception 'CREATOR_FINAL_EXPORT_INCIDENT_MEDIA_PRESENT';
  end if;
  if pg_catalog.to_regclass('storage.objects') is null then raise exception 'CREATOR_FINAL_EXPORT_STORAGE_AUTHORITY_UNAVAILABLE'; end if;
  execute 'select count(*) from storage.objects where bucket_id=$1 and name=$2' into v_storage_count using 'movies',v_path;
  if v_storage_count <> 0 then raise exception 'CREATOR_FINAL_EXPORT_INCIDENT_STORAGE_PRESENT'; end if;
  select * into v_reservation from public.velto_credit_reservations where id=v_run.credit_reservation_id and user_id=p_owner_user_id for update;
  if v_reservation.id is null or v_reservation.status is distinct from 'settled'
      or v_reservation.settled_credits <> 2 or v_reservation.provider_request_id is distinct from v_job::text
      or coalesce((v_reservation.metadata->>'provider_dispatched')::boolean,false) is not true then
    raise exception 'CREATOR_FINAL_EXPORT_INCIDENT_SETTLEMENT_INVALID';
  end if;
  v_attempt_key := nullif(v_queue.payload->>'economicAttemptKey','');
  select * into v_economic from public.velto_creator_economic_operations where attempt_key=v_attempt_key
    and user_id=p_owner_user_id and project_id=v_project::text and operation_type='creator_export' for update;
  if v_economic.id is null or v_economic.state is distinct from 'reserved' then raise exception 'CREATOR_FINAL_EXPORT_INCIDENT_ECONOMIC_INVALID'; end if;
  select * into v_admission from public.velto_storage_admissions where id=v_run.storage_admission_id
    and owner_user_id=p_owner_user_id and project_reference=v_project::text and purpose='final_movie_export' and media_kind='video' for update;
  if v_admission.id is null or v_admission.consumed_at is not null then raise exception 'CREATOR_FINAL_EXPORT_INCIDENT_ADMISSION_INVALID'; end if;
  perform public.velto_credit_grant(p_owner_user_id,2,'creator-final-export-incident-refund:' || v_job::text,'refund',
    jsonb_build_object('jobId',v_job,'evidenceSha256',p_evidence_sha256,'reason','verified_nonbillable_expired_render_without_output'));
  update public.velto_creator_economic_operations set state='reconciled',cost_status='not_billable',
    cost_reason='incident_0e20dfd9_verified_nonbillable_no_output',ambiguity_reason=null,reconciled_at=clock_timestamp(),updated_at=clock_timestamp()
   where id=v_economic.id;
  update public.velto_storage_admissions set consumption_started_at=null,consumption_token=null where id=v_admission.id and consumed_at is null;
  update public.velto_creator_final_export_runs set state='failed',render_lease_expires_at=null,updated_at=clock_timestamp() where job_id=v_job;
  insert into public.velto_creator_final_export_rearm_authorizations(predecessor_job_id,owner_user_id,project_id,
    production_signature_sha256,generation,evidence_sha256,reason)
  values(v_job,p_owner_user_id,v_project,p_expected_production_signature_sha256,1,p_evidence_sha256,
    'incident_0e20dfd9_verified_nonbillable_no_output');
  return jsonb_build_object('status','reconciled','generation',1,'refundCredits',2);
end $$;

revoke all on function public.velto_reconcile_incident_0e20dfd9_creator_final_export(uuid,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.velto_reconcile_incident_0e20dfd9_creator_final_export(uuid,timestamptz,text,text) to service_role;

commit;
