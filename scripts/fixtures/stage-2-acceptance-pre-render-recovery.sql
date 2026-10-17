\set ON_ERROR_STOP on

insert into auth.users(id) values ('77777777-7777-4777-8777-777777777777');
update public.velto_credit_accounts
set balance_credits=10,reserved_credits=6,lifetime_granted_credits=10
where user_id='77777777-7777-4777-8777-777777777777';

do $$
declare
  owner_id constant uuid := '77777777-7777-4777-8777-777777777777';
  project_id constant uuid := '88888888-8888-4888-8888-888888888888';
  admission_one constant uuid := '90000000-0000-4000-8000-000000000001';
  admission_two constant uuid := '90000000-0000-4000-8000-000000000002';
  admission_three constant uuid := '90000000-0000-4000-8000-000000000003';
  reservation_one constant uuid := '91000000-0000-4000-8000-000000000001';
  reservation_two constant uuid := '91000000-0000-4000-8000-000000000002';
  reservation_three constant uuid := '91000000-0000-4000-8000-000000000003';
  project_revision constant timestamptz := '2026-10-17 12:00:00+00';
  claimed public.velto_jobs;
  job_one public.velto_jobs;
  job_two public.velto_jobs;
  job_three public.velto_jobs;
  result jsonb;
  before_snapshot jsonb;
  after_snapshot jsonb;
begin
  insert into public.velto_projects(id,owner_user_id,flow_type,updated_at,exported_movie_url)
  values(project_id,owner_id,'creator_lab',project_revision,'https://existing.example.test/final.mp4');

  insert into public.velto_storage_admissions(id,owner_user_id,media_kind,purpose,project_reference,expires_at,consumption_started_at,consumption_token)
  values
    (admission_one,owner_id,'video','final_movie_export',project_id::text,now()+interval '1 hour',now(),'92000000-0000-4000-8000-000000000001'),
    (admission_two,owner_id,'video','final_movie_export',project_id::text,now()+interval '1 hour',now(),'92000000-0000-4000-8000-000000000002'),
    (admission_three,owner_id,'video','final_movie_export',project_id::text,now()+interval '1 hour',now(),'92000000-0000-4000-8000-000000000003');

  insert into public.velto_credit_reservations(id,user_id,operation_type,provider,reference_id,reserved_credits,status,idempotency_key)
  values
    (reservation_one,owner_id,'creator_export','velto-export',project_id::text,2,'reserved','acceptance-one'),
    (reservation_two,owner_id,'creator_export','velto-export',project_id::text,2,'reserved','acceptance-two'),
    (reservation_three,owner_id,'creator_export','velto-export',project_id::text,2,'reserved','acceptance-three');

  insert into public.velto_creator_economic_operations(attempt_key,logical_operation_id,idempotency_key,credit_reservation_id,user_id,project_id,route,operation_type,provider,state,cost_status,cost_reason)
  values
    ('acceptance-econ-one','acceptance-one','acceptance-one',reservation_one,owner_id,project_id::text,'/api/creator-final-export-jobs','creator_export','velto-export','reserved','unknown','fixture'),
    ('acceptance-econ-two','acceptance-two','acceptance-two',reservation_two,owner_id,project_id::text,'/api/creator-final-export-jobs','creator_export','velto-export','reserved','unknown','fixture');

  select * into job_one from public.velto_enqueue_creator_final_export(
    owner_id,project_id,project_revision,'signature-one',repeat('1',64),'{}',repeat('2',64),repeat('3',64),
    jsonb_build_object('creditReservationId',reservation_one,'storageAdmissionId',admission_one,'economicAttemptKey','acceptance-econ-one'));
  select * into claimed from public.velto_job_claim('acceptance-worker',60);
  if claimed.id is distinct from job_one.id or claimed.status is distinct from 'running' then raise exception 'CLAIM_ONE_FAILED'; end if;

  select public.velto_reject_creator_final_export_pre_render(job_one.id,owner_id,repeat('2',64),repeat('3',64),'acceptance-worker','media_identity_invalid') into result;
  if result->>'status' is distinct from 'failed' then raise exception 'RECOVERY_ONE_FAILED'; end if;
  if (select state from public.velto_creator_final_export_runs where job_id=job_one.id) is distinct from 'failed' then raise exception 'RUN_NOT_FAILED'; end if;
  if (select status from public.velto_credit_reservations where id=reservation_one) is distinct from 'released' then raise exception 'CREDIT_NOT_RELEASED'; end if;
  if (select state from public.velto_creator_economic_operations where attempt_key='acceptance-econ-one') is distinct from 'released' then raise exception 'ECON_NOT_RELEASED'; end if;
  if exists(select 1 from public.velto_storage_admissions where id=admission_one and (consumption_started_at is not null or consumption_token is not null or consumed_at is not null)) then raise exception 'ADMISSION_NOT_ABORTED'; end if;
  if (select exported_movie_url from public.velto_projects where id=project_id) is distinct from 'https://existing.example.test/final.mp4' then raise exception 'PREVIOUS_FINAL_CHANGED'; end if;
  select public.velto_reject_creator_final_export_pre_render(job_one.id,owner_id,repeat('2',64),repeat('3',64),'acceptance-worker','media_identity_invalid') into result;
  if result->>'status' is distinct from 'already_failed' then raise exception 'RECOVERY_NOT_IDEMPOTENT'; end if;
  if (select count(*) from public.velto_credit_ledger where reservation_id=reservation_one and entry_type='release') <> 1 then raise exception 'DUPLICATE_RELEASE'; end if;

  select * into job_two from public.velto_enqueue_creator_final_export(
    owner_id,project_id,project_revision,'signature-two',repeat('4',64),'{}',repeat('5',64),repeat('6',64),
    jsonb_build_object('creditReservationId',reservation_two,'storageAdmissionId',admission_two,'economicAttemptKey','acceptance-econ-two'));
  select * into claimed from public.velto_job_claim('acceptance-worker',60);
  if claimed.id is distinct from job_two.id then raise exception 'CLAIM_TWO_FAILED'; end if;
  select jsonb_build_object('run',(select to_jsonb(r) from public.velto_creator_final_export_runs r where job_id=job_two.id),
    'admission',(select to_jsonb(a) from public.velto_storage_admissions a where id=admission_two),
    'reservation',(select to_jsonb(c) from public.velto_credit_reservations c where id=reservation_two),
    'economic',(select to_jsonb(e) from public.velto_creator_economic_operations e where attempt_key='acceptance-econ-two')) into before_snapshot;
  begin
    perform public.velto_reject_creator_final_export_pre_render(job_two.id,owner_id,repeat('5',64),repeat('6',64),'wrong-worker','media_identity_invalid');
    raise exception 'WRONG_WORKER_ACCEPTED';
  exception when others then
    if sqlerrm = 'WRONG_WORKER_ACCEPTED' then raise; end if;
  end;
  select jsonb_build_object('run',(select to_jsonb(r) from public.velto_creator_final_export_runs r where job_id=job_two.id),
    'admission',(select to_jsonb(a) from public.velto_storage_admissions a where id=admission_two),
    'reservation',(select to_jsonb(c) from public.velto_credit_reservations c where id=reservation_two),
    'economic',(select to_jsonb(e) from public.velto_creator_economic_operations e where attempt_key='acceptance-econ-two')) into after_snapshot;
  if before_snapshot is distinct from after_snapshot then raise exception 'WRONG_WORKER_ROLLBACK_FAILED'; end if;

  select * into job_three from public.velto_enqueue_creator_final_export(
    owner_id,project_id,project_revision,'signature-three',repeat('7',64),'{}',repeat('8',64),repeat('9',64),
    jsonb_build_object('creditReservationId',reservation_three,'storageAdmissionId',admission_three,'economicAttemptKey','missing-economic-operation'));
  update public.velto_jobs set priority=300 where id=job_three.id;
  update public.velto_jobs set status='failed',completed_at=now(),lease_owner=null,lease_expires_at=null where id=job_two.id;
  select * into claimed from public.velto_job_claim('acceptance-worker',60);
  if claimed.id is distinct from job_three.id then raise exception 'CLAIM_THREE_FAILED'; end if;
  select jsonb_build_object('run',(select to_jsonb(r) from public.velto_creator_final_export_runs r where job_id=job_three.id),
    'admission',(select to_jsonb(a) from public.velto_storage_admissions a where id=admission_three),
    'reservation',(select to_jsonb(c) from public.velto_credit_reservations c where id=reservation_three),
    'account',(select to_jsonb(a) from public.velto_credit_accounts a where user_id=owner_id)) into before_snapshot;
  begin
    perform public.velto_reject_creator_final_export_pre_render(job_three.id,owner_id,repeat('8',64),repeat('9',64),'acceptance-worker','media_identity_invalid');
    raise exception 'PARTIAL_FAILURE_ACCEPTED';
  exception when others then
    if sqlerrm = 'PARTIAL_FAILURE_ACCEPTED' then raise; end if;
  end;
  select jsonb_build_object('run',(select to_jsonb(r) from public.velto_creator_final_export_runs r where job_id=job_three.id),
    'admission',(select to_jsonb(a) from public.velto_storage_admissions a where id=admission_three),
    'reservation',(select to_jsonb(c) from public.velto_credit_reservations c where id=reservation_three),
    'account',(select to_jsonb(a) from public.velto_credit_accounts a where user_id=owner_id)) into after_snapshot;
  if before_snapshot is distinct from after_snapshot then raise exception 'PARTIAL_FAILURE_ROLLBACK_FAILED'; end if;
end;
$$;

do $$ begin
  if not (select relrowsecurity from pg_class where oid='public.velto_creator_final_export_runs'::regclass) then raise exception 'RLS_DISABLED'; end if;
  if not has_function_privilege('service_role','public.velto_reject_creator_final_export_pre_render(uuid,uuid,text,text,text,text)','execute') then raise exception 'SERVICE_ROLE_EXECUTE_MISSING'; end if;
  if has_function_privilege('anon','public.velto_reject_creator_final_export_pre_render(uuid,uuid,text,text,text,text)','execute')
      or has_function_privilege('authenticated','public.velto_reject_creator_final_export_pre_render(uuid,uuid,text,text,text,text)','execute')
      or has_function_privilege('public','public.velto_reject_creator_final_export_pre_render(uuid,uuid,text,text,text,text)','execute') then
    raise exception 'UNAUTHORIZED_EXECUTE_PRESENT';
  end if;
end $$;

select jsonb_build_object(
  'postgresVersion', current_setting('server_version'),
  'releasedReservations', (select count(*) from public.velto_credit_reservations where status='released'),
  'releaseLedgerEntries', (select count(*) from public.velto_credit_ledger where entry_type='release'),
  'failedRuns', (select count(*) from public.velto_creator_final_export_runs where state='failed'),
  'previousFinalPreserved', (select exported_movie_url from public.velto_projects where id='88888888-8888-4888-8888-888888888888')
) as stage_2_acceptance_recovery_evidence;
