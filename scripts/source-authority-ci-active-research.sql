\set ON_ERROR_STOP on
-- Real PostgreSQL transactions, synthetic project and role identities.
set role service_role;
do $$
declare o constant uuid := '00000000-0000-0000-0000-000000000001'; p constant text := '10000000-0000-0000-0000-000000000001'; a bigint; b bigint; d text; failed boolean; s jsonb;
begin
 a:=public.creator_begin_research_revision(o,p);
 if a<>1 then raise exception 'FIRST_REVISION'; end if;
 s:=jsonb_build_object('owner_user_id',o::text,'project_id',p,'snapshot_digest',repeat('a',64),'editorial_context','{}'::jsonb,'original_research_graph','{}'::jsonb,'initial_research_graph','{}'::jsonb,'research_graph_digest',repeat('c',64));
 d:=public.creator_activate_research_snapshot(o,p,a,null,s);
 if d<>repeat('a',64) then raise exception 'FIRST_ACTIVATION'; end if;
 a:=public.creator_begin_research_revision(o,p); b:=public.creator_begin_research_revision(o,p);
 if (select active_research_snapshot_digest from public.velto_projects where id::text=p) is not null then raise exception 'REVISION_NOT_INVALIDATED'; end if;
 s:=jsonb_set(s,'{snapshot_digest}',to_jsonb(repeat('b',64)));
 perform public.creator_activate_research_snapshot(o,p,b,null,s);
 failed:=false; begin perform public.creator_activate_research_snapshot(o,p,a,null,s); exception when others then failed:=true; end;
 if not failed then raise exception 'STALE_ACTIVATION_ACCEPTED'; end if;
 s:=jsonb_set(jsonb_set(s,'{snapshot_digest}',to_jsonb(repeat('d',64))),'{parent_snapshot_digest}',to_jsonb(repeat('b',64)));
 perform public.creator_activate_research_snapshot(o,p,b,repeat('b',64),s);
 failed:=false; begin perform public.creator_activate_research_snapshot(o,p,b,repeat('b',64),s); exception when others then failed:=true; end;
 if not failed then raise exception 'COMPETING_CHILD_ACCEPTED'; end if;
 failed:=false; begin perform public.creator_activate_research_snapshot(o,p,b,repeat('d',64),s); exception when others then failed:=true; end;
 if not failed or (select active_research_snapshot_digest from public.velto_projects where id::text=p)<>repeat('d',64) then raise exception 'FAILED_INSERT_CHANGED_ACTIVE'; end if;
 update public.velto_projects set updated_at=now() where id::text=p;
 if (select active_research_snapshot_digest from public.velto_projects where id::text=p)<>repeat('d',64) then raise exception 'AUTOSAVE_LOST_ACTIVE'; end if;
 update public.velto_projects set exported_movie_result = '{"creatorProjectState":{"brief":{"topic":"new topic","language":"en"}}}'::jsonb where id::text=p;
 if (select active_research_snapshot_digest from public.velto_projects where id::text=p) is not null or (select research_revision from public.velto_projects where id::text=p) <> b+1 then raise exception 'RESEARCH_CHANGE_NOT_INVALIDATED'; end if;
 failed:=false; begin perform public.creator_begin_research_revision('00000000-0000-0000-0000-000000000002',p); exception when others then failed:=true; end;
 if not failed then raise exception 'CROSS_OWNER_ACCEPTED'; end if;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform public.creator_begin_research_revision('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'); raise exception 'ANON_EXECUTE_ACCEPTED'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set role authenticated;
do $$ begin
  begin perform public.creator_begin_research_revision('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'); raise exception 'AUTHENTICATED_EXECUTE_ACCEPTED'; exception when insufficient_privilege then null; end;
end $$;
reset role;
