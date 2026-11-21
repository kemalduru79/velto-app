\set ON_ERROR_STOP on
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111');
select public.velto_credit_grant('11111111-1111-4111-8111-111111111111',10,'stage2c-fixture','grant','{}');
insert into public.velto_projects(id,owner_user_id,flow_type,updated_at)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','creator_lab','2026-10-16 13:00:00+00');
insert into public.velto_storage_admissions(id,owner_user_id,media_kind,purpose,project_reference,expires_at)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','video','final_movie_export','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now()+interval '1 day');

do $$
declare reserve_result jsonb; v_reservation_id uuid; j public.velto_jobs; claim jsonb; install jsonb; econ jsonb;
begin
  reserve_result := public.velto_credit_reserve('11111111-1111-4111-8111-111111111111',1,'creator_export',
    'creator-final-export:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:sig','velto-export','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{}',now()+interval '1 day');
  v_reservation_id := (reserve_result#>>'{reservation,id}')::uuid;
  insert into public.velto_creator_economic_operations(attempt_key,logical_operation_id,idempotency_key,credit_reservation_id,
    user_id,project_id,route,operation_type,product_tier,provider,provider_tier,model,state,quantities,cost_status,currency,cost_components,cost_reason)
  values ('creator-final-export:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:sig:velto-export:1',
    'creator-final-export:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:sig','creator-final-export:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:sig',v_reservation_id,
    '11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','/api/creator-final-export-jobs','creator_export',
    'standard','velto-export','infrastructure','ffmpeg-1280x720-25fps','reserved','{"sceneCount":36,"requestCount":1}','unknown','USD','{}','rates unapproved');
  select * into j from public.velto_enqueue_creator_final_export('11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-10-16 13:00:00+00','sig',repeat('a',64),
    '{"audioTimeline":{"musicIntent":{"mode":"none"},"placements":[]},"scenes":36}',repeat('b',64),repeat('c',64),
    jsonb_build_object('creditReservationId',v_reservation_id,'reservedCredits',1,
      'economicAttemptKey','creator-final-export:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:sig:velto-export:1'));
  select public.velto_claim_creator_final_export_render(j.id,'11111111-1111-4111-8111-111111111111',repeat('b',64),repeat('c',64),
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd') into claim;
  assert claim->>'status'='claimed';
  assert (select provider_request_id=j.id::text and metadata->>'provider_dispatched'='true'
    from public.velto_credit_reservations where id=v_reservation_id), 'render claim did not mark provider dispatch';
  update public.velto_creator_final_export_runs set render_lease_expires_at=now()-interval '1 second' where job_id=j.id;
  select public.velto_claim_creator_final_export_render(j.id,'11111111-1111-4111-8111-111111111111',repeat('b',64),repeat('c',64),
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd') into claim;
  assert claim->>'status'='rendering' and (claim->>'leaseExpired')::boolean, 'expired ambiguous render was reclaimed';
  perform public.velto_finalize_creator_final_export_admission(j.id,'11111111-1111-4111-8111-111111111111',repeat('b',64));
  perform public.velto_record_creator_final_export_upload(j.id,repeat('b',64),repeat('c',64),'movies',
    'creator/11111111-1111-4111-8111-111111111111/final/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/jobs/'||j.id||'.mp4',
    'https://storage.test/'||j.id||'.mp4',4000,repeat('d',64),'{"sceneCount":36}');
  select public.velto_install_creator_final_export(j.id,'{"sceneCount":36}',jsonb_build_array(
    jsonb_build_object('url','https://storage.test/'||j.id||'.mp4','reference_type','final_video','reference_key','project:final-video'))) into install;
  assert install->>'status'='installed';
  select public.velto_settle_creator_final_export_economics('creator-final-export:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:sig:velto-export:1',
    j.id,'creator/final/job.mp4',36,4000) into econ;
  assert econ->>'status'='settled';
  select public.velto_settle_creator_final_export_economics('creator-final-export:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:sig:velto-export:1',
    j.id,'creator/final/job.mp4',36,4000) into econ;
  assert econ->>'status'='already_settled';
  perform public.velto_credit_settle('11111111-1111-4111-8111-111111111111',v_reservation_id,1,null,j.id::text,'{"outputReady":true}');
  perform public.velto_credit_settle('11111111-1111-4111-8111-111111111111',v_reservation_id,1,null,j.id::text,'{"workerRestart":true}');
  assert (select balance_credits=9 and reserved_credits=0 and lifetime_used_credits=1 from public.velto_credit_accounts where user_id='11111111-1111-4111-8111-111111111111');
  assert (select count(*)=1 from public.velto_credit_ledger where reservation_id=v_reservation_id and entry_type='settle');
  assert (select state='provider_billed' and export_id=j.id::text and quantities->>'sceneCount'='36' and quantities->>'outputBytes'='4000'
    from public.velto_creator_economic_operations where attempt_key='creator-final-export:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:sig:velto-export:1');
end $$;

select jsonb_build_object(
  'reservations',(select count(*) from public.velto_credit_reservations),
  'reserveLedger',(select count(*) from public.velto_credit_ledger where entry_type='reserve'),
  'settleLedger',(select count(*) from public.velto_credit_ledger where entry_type='settle'),
  'economicOperations',(select count(*) from public.velto_creator_economic_operations),
  'balance',(select balance_credits from public.velto_credit_accounts where user_id='11111111-1111-4111-8111-111111111111')
) as stage2c_result;
