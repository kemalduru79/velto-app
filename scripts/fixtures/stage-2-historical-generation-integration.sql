\set ON_ERROR_STOP on

do $$
declare
  v_owner constant uuid := '77777777-7777-4777-8777-777777777777';
  v_project constant uuid := '88888888-8888-4888-8888-888888888888';
  v_predecessor public.velto_creator_final_export_runs;
begin
  select * into v_predecessor from public.velto_creator_final_export_runs
   where owner_user_id=v_owner and project_id=v_project and production_signature_sha256=repeat('1',64);
  if v_predecessor.generation <> 0 or v_predecessor.state <> 'failed' then raise exception 'GENERATION_ZERO_HISTORY_CHANGED'; end if;
  insert into public.velto_creator_final_export_rearm_authorizations(predecessor_job_id,owner_user_id,project_id,
    production_signature_sha256,generation,evidence_sha256,reason)
  values(v_predecessor.job_id,v_owner,v_project,repeat('1',64),1,repeat('a',64),'isolated_verified_nonbillable_fixture');
  insert into public.velto_credit_reservations(id,user_id,operation_type,provider,reference_id,reserved_credits,status,idempotency_key)
  values('91000000-0000-4000-8000-000000000004',v_owner,'creator_export','velto-export',v_project::text,2,'reserved','generation-one');
end $$;

select public.velto_resolve_creator_final_export_generation(
  '77777777-7777-4777-8777-777777777777','88888888-8888-4888-8888-888888888888',repeat('1',64));
