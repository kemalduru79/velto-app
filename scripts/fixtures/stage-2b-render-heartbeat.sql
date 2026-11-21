\set ON_ERROR_STOP on
do $$
declare j public.velto_jobs; before_lease timestamptz; after_lease timestamptz;
begin
  select * into j from public.velto_jobs where project_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  insert into public.velto_storage_admissions(id,owner_user_id,media_kind,purpose,project_reference,expires_at)
  values ('77777777-7777-4777-8777-777777777777','22222222-2222-4222-8222-222222222222','video','final_movie_export','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',now()+interval '1 day');
  perform public.velto_claim_creator_final_export_render(j.id,'22222222-2222-4222-8222-222222222222',repeat('2',64),repeat('3',64),'77777777-7777-4777-8777-777777777777');
  select render_lease_expires_at into before_lease from public.velto_creator_final_export_runs where job_id=j.id;
  perform pg_sleep(0.05);
  perform public.velto_heartbeat_creator_final_export_render(j.id,'22222222-2222-4222-8222-222222222222',repeat('2',64),repeat('3',64));
  select render_lease_expires_at into after_lease from public.velto_creator_final_export_runs where job_id=j.id;
  assert after_lease > before_lease, 'render heartbeat did not renew lease';
end $$;
select 'render_heartbeat=renewed' as stage2b_heartbeat_result;
