\set ON_ERROR_STOP on

insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
insert into public.velto_projects(id,owner_user_id,flow_type,updated_at,exported_movie_url,exported_movie_result,export_signature)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','creator_lab','2026-10-15 20:52:19.553394+00',
  'https://storage.test/previous.mp4','{"previous":true}','previous-signature');
insert into public.velto_media_assets(id,owner_user_id,bucket,storage_path,public_url,media_kind,mime_type,size_bytes,metadata)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','movies','previous.mp4',
  'https://storage.test/previous.mp4','final_video','video/mp4',100,'{"projectId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}');
insert into public.velto_media_asset_references(owner_user_id,asset_id,project_id,reference_type,reference_key)
values ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','final_video','project:final-video');
insert into public.velto_storage_admissions(id,owner_user_id,media_kind,purpose,project_reference,expires_at)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','video','final_movie_export','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now()+interval '1 day');
insert into public.velto_creator_economic_operations values ('historical','provider_billed','{"requestCount":1}','2026-10-15 20:00:00+00');

do $$
declare j1 public.velto_jobs; j2 public.velto_jobs; c jsonb; u jsonb; i jsonb; before_econ jsonb;
begin
  select * into j1 from public.velto_enqueue_creator_final_export(
    '11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-10-15 20:52:19.553394+00',
    'sig-v1',repeat('a',64),'{"version":1,"audioTimeline":{"musicIntent":"none","placements":[]},"scenes":[1,2,3]}'::jsonb,
    repeat('b',64),repeat('c',64),'{"renderPayload":{"scenes":[1,2,3]}}'::jsonb);
  select * into j2 from public.velto_enqueue_creator_final_export(
    '11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-10-15 20:52:19.553394+00',
    'sig-v1',repeat('a',64),'{"version":1,"audioTimeline":{"musicIntent":"none","placements":[]},"scenes":[1,2,3]}'::jsonb,
    repeat('b',64),repeat('c',64),'{"renderPayload":{"scenes":[1,2,3]}}'::jsonb);
  assert j1.id=j2.id, 'duplicate enqueue produced distinct jobs';
  assert (select count(*) from public.velto_creator_final_export_runs)=1, 'duplicate run created';
  begin
    perform public.velto_enqueue_creator_final_export('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now(),
      'stale',repeat('d',64),'{}',repeat('e',64),repeat('f',64),'{}');
    raise exception 'stale enqueue accepted';
  exception when others then assert sqlerrm like '%CREATOR_FINAL_EXPORT_PROJECT_STALE%', 'wrong stale error'; end;
  select public.velto_claim_creator_final_export_render(j1.id,'11111111-1111-4111-8111-111111111111',repeat('b',64),repeat('c',64),'dddddddd-dddd-4ddd-8ddd-dddddddddddd') into c;
  assert c->>'status'='claimed', 'render claim failed';
  select public.velto_claim_creator_final_export_render(j1.id,'11111111-1111-4111-8111-111111111111',repeat('b',64),repeat('c',64),'dddddddd-dddd-4ddd-8ddd-dddddddddddd') into c;
  assert c->>'status'='rendering', 'active lease did not suppress duplicate render';
  perform public.velto_finalize_creator_final_export_admission(j1.id,'11111111-1111-4111-8111-111111111111',repeat('b',64));
  select public.velto_record_creator_final_export_upload(j1.id,repeat('b',64),repeat('c',64),'movies',
    'creator/11111111-1111-4111-8111-111111111111/final/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/jobs/'||j1.id||'.mp4',
    'https://storage.test/'||j1.id||'.mp4',1000,repeat('d',64),'{"durationSeconds":584.2}') into u;
  before_econ := (select jsonb_agg(to_jsonb(e) order by attempt_key) from public.velto_creator_economic_operations e);
  select public.velto_install_creator_final_export(j1.id,'{"durationSeconds":584.2}',jsonb_build_array(
    jsonb_build_object('url','https://storage.test/previous.mp4','reference_type','asset_history','reference_key','previous'),
    jsonb_build_object('url','https://storage.test/'||j1.id||'.mp4','reference_type','final_video','reference_key','project:final-video'))) into i;
  assert i->>'status'='installed', 'install failed';
  assert (select count(*) from public.velto_media_assets where public_url='https://storage.test/previous.mp4')=1, 'previous asset lost';
  assert before_econ=(select jsonb_agg(to_jsonb(e) order by attempt_key) from public.velto_creator_economic_operations e), 'economics changed';
  select public.velto_install_creator_final_export(j1.id,'{"durationSeconds":584.2}',jsonb_build_array(
    jsonb_build_object('url','https://storage.test/'||j1.id||'.mp4','reference_type','final_video','reference_key','project:final-video'))) into i;
  assert i->>'status'='already_installed', 'idempotent install was not distinguished';
end $$;

do $$
declare j public.velto_jobs; result jsonb; asset_count bigint; reference_count bigint;
begin
  insert into public.velto_projects(id,owner_user_id,flow_type,updated_at)
  values ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','creator_lab','2026-10-16 11:00:00+00');
  insert into public.velto_storage_admissions(id,owner_user_id,media_kind,purpose,project_reference,expires_at)
  values ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','video','final_movie_export','33333333-3333-4333-8333-333333333333',now()+interval '1 day');
  select * into j from public.velto_enqueue_creator_final_export('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','2026-10-16 11:00:00+00',
    'stale-signature',repeat('4',64),'{}',repeat('5',64),repeat('6',64),'{}');
  perform public.velto_claim_creator_final_export_render(j.id,'11111111-1111-4111-8111-111111111111',repeat('5',64),repeat('6',64),'44444444-4444-4444-8444-444444444444');
  perform public.velto_finalize_creator_final_export_admission(j.id,'11111111-1111-4111-8111-111111111111',repeat('5',64));
  perform public.velto_record_creator_final_export_upload(j.id,repeat('5',64),repeat('6',64),'movies',
    'creator/11111111-1111-4111-8111-111111111111/final/33333333-3333-4333-8333-333333333333/jobs/'||j.id||'.mp4',
    'https://storage.test/stale-'||j.id||'.mp4',2000,repeat('7',64),'{}');
  update public.velto_projects set updated_at='2026-10-16 11:01:00+00' where id='33333333-3333-4333-8333-333333333333';
  asset_count := (select count(*) from public.velto_media_assets);
  reference_count := (select count(*) from public.velto_media_asset_references);
  select public.velto_install_creator_final_export(j.id,'{}',jsonb_build_array(
    jsonb_build_object('url','https://storage.test/stale-'||j.id||'.mp4','reference_type','final_video','reference_key','project:final-video'))) into result;
  assert result->>'status'='stale', 'changed project was not rejected';
  assert asset_count=(select count(*) from public.velto_media_assets), 'stale output registered an asset';
  assert reference_count=(select count(*) from public.velto_media_asset_references), 'stale output changed references';
  assert (select exported_movie_url is null from public.velto_projects where id='33333333-3333-4333-8333-333333333333'), 'stale output changed project';
end $$;

do $$
declare j public.velto_jobs; asset_count bigint; reference_count bigint;
begin
  insert into public.velto_projects(id,owner_user_id,flow_type,updated_at)
  values ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','creator_lab','2026-10-16 12:00:00+00');
  insert into public.velto_storage_admissions(id,owner_user_id,media_kind,purpose,project_reference,expires_at)
  values ('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111','video','final_movie_export','55555555-5555-4555-8555-555555555555',now()+interval '1 day');
  select * into j from public.velto_enqueue_creator_final_export('11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555','2026-10-16 12:00:00+00',
    'conflict-signature',repeat('8',64),'{}',repeat('9',64),repeat('a',64),'{}');
  perform public.velto_claim_creator_final_export_render(j.id,'11111111-1111-4111-8111-111111111111',repeat('9',64),repeat('a',64),'66666666-6666-4666-8666-666666666666');
  perform public.velto_finalize_creator_final_export_admission(j.id,'11111111-1111-4111-8111-111111111111',repeat('9',64));
  perform public.velto_record_creator_final_export_upload(j.id,repeat('9',64),repeat('a',64),'movies',
    'creator/11111111-1111-4111-8111-111111111111/final/55555555-5555-4555-8555-555555555555/jobs/'||j.id||'.mp4',
    'https://storage.test/conflict-'||j.id||'.mp4',3000,repeat('b',64),'{}');
  insert into public.velto_media_assets(owner_user_id,bucket,storage_path,public_url,media_kind,mime_type,size_bytes,metadata)
  values ('11111111-1111-4111-8111-111111111111','movies',
    'creator/11111111-1111-4111-8111-111111111111/final/55555555-5555-4555-8555-555555555555/jobs/'||j.id||'.mp4',
    'https://storage.test/conflict-'||j.id||'.mp4','final_video','video/mp4',999,'{}');
  asset_count := (select count(*) from public.velto_media_assets);
  reference_count := (select count(*) from public.velto_media_asset_references);
  begin
    perform public.velto_install_creator_final_export(j.id,'{}',jsonb_build_array(
      jsonb_build_object('url','https://storage.test/conflict-'||j.id||'.mp4','reference_type','final_video','reference_key','project:final-video')));
    raise exception 'conflicting registration accepted';
  exception when others then assert sqlerrm like '%CREATOR_FINAL_EXPORT_ASSET_CONFLICT%', 'wrong conflict error'; end;
  assert asset_count=(select count(*) from public.velto_media_assets), 'failed install changed assets';
  assert reference_count=(select count(*) from public.velto_media_asset_references), 'failed install changed references';
  assert (select exported_movie_url is null from public.velto_projects where id='55555555-5555-4555-8555-555555555555'), 'failed install changed project';
end $$;

do $$ begin
  assert has_function_privilege('service_role','public.velto_enqueue_creator_final_export(uuid,uuid,timestamptz,text,text,jsonb,text,text,jsonb)','execute');
  assert not has_function_privilege('anon','public.velto_enqueue_creator_final_export(uuid,uuid,timestamptz,text,text,jsonb,text,text,jsonb)','execute');
  assert not has_function_privilege('authenticated','public.velto_enqueue_creator_final_export(uuid,uuid,timestamptz,text,text,jsonb,text,text,jsonb)','execute');
  assert not has_function_privilege('public','public.velto_enqueue_creator_final_export(uuid,uuid,timestamptz,text,text,jsonb,text,text,jsonb)','execute');
end $$;

select jsonb_build_object('jobs',(select count(*) from public.velto_jobs),'runs',(select count(*) from public.velto_creator_final_export_runs),
  'assets',(select count(*) from public.velto_media_assets),'references',(select count(*) from public.velto_media_asset_references),
  'economics',(select count(*) from public.velto_creator_economic_operations)) as stage2b_result;
