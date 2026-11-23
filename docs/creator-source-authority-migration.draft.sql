-- DESIGN DRAFT ONLY: not a migration and not applied. Review with a local
-- Supabase database and security tests before generating a real migration.
-- Only the server's service role may read or write verification records.
create table public.creator_source_authority_snapshots (
  owner_user_id uuid not null references auth.users(id),
  project_id text not null,
  snapshot_digest text not null check (snapshot_digest ~ '^[0-9a-f]{64}$'),
  editorial_context jsonb not null,
  parent_snapshot_digest text,
  original_research_graph jsonb,
  initial_research_graph jsonb,
  research_graph_digest text check (research_graph_digest is null or research_graph_digest ~ '^[0-9a-f]{64}$'),
  check ((original_research_graph is null and initial_research_graph is null and research_graph_digest is null) or (original_research_graph is not null and initial_research_graph is not null and research_graph_digest is not null)),
  created_at timestamptz not null default now(),
  primary key (owner_user_id, project_id, snapshot_digest),
  foreign key (owner_user_id, project_id, parent_snapshot_digest) references public.creator_source_authority_snapshots (owner_user_id, project_id, snapshot_digest),
  check (parent_snapshot_digest is null or parent_snapshot_digest <> snapshot_digest)
);
alter table public.creator_source_authority_snapshots enable row level security;
revoke all on public.creator_source_authority_snapshots from public, anon, authenticated;
grant select, insert on public.creator_source_authority_snapshots to service_role;

create table public.creator_source_authority_verifications (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  project_id text not null,
  snapshot_digest text not null check (snapshot_digest ~ '^[0-9a-f]{64}$'),
  source_id text not null,
  claim_id text not null,
  evidence_id text not null,
  source_digest text not null check (source_digest ~ '^[0-9a-f]{64}$'),
  passage_digest text not null check (passage_digest ~ '^[0-9a-f]{64}$'),
  passage_verification text not null check (passage_verification = 'exact_source_match'),
  authority_classification text not null check (authority_classification in ('original_research', 'primary_document', 'secondary', 'unknown')),
  document_digest text not null check (document_digest ~ '^[0-9a-f]{64}$'),
  qualification_method text not null,
  claim_evidence_disposition text not null default 'insufficient_or_ambiguous_support' check (claim_evidence_disposition in ('documented_methodological_limitation', 'independent_editorial_inference', 'insufficient_or_ambiguous_support')),
  disposition_rationale text not null default '',
  check (claim_evidence_disposition = 'insufficient_or_ambiguous_support' or length(trim(disposition_rationale)) >= 12),
  reviewer_user_id uuid not null references auth.users(id),
  reviewer_authorization text not null,
  review_basis text not null,
  publisher_authorship_confirmed boolean not null,
  qualified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > qualified_at),
  check (authority_classification not in ('original_research', 'primary_document') or publisher_authorship_confirmed),
  foreign key (owner_user_id, project_id, snapshot_digest) references public.creator_source_authority_snapshots (owner_user_id, project_id, snapshot_digest),
  unique (owner_user_id, project_id, snapshot_digest, claim_id, evidence_id)
);
alter table public.creator_source_authority_verifications enable row level security;
revoke all on public.creator_source_authority_verifications from public, anon, authenticated;
grant select, insert, update, delete on public.creator_source_authority_verifications to service_role;
-- Revoke default service-role privileges as well; the application uses only
-- append-only inserts and reads for these records.
revoke update, delete, truncate on public.creator_source_authority_snapshots from service_role;
revoke update, delete, truncate on public.creator_source_authority_verifications from service_role;

-- Draft only. Both operations are SECURITY INVOKER and service-role-only.
alter table public.velto_projects add column research_revision bigint not null default 0;
alter table public.velto_projects add column active_research_snapshot_digest text;
alter table public.creator_source_authority_snapshots add column research_revision bigint;

create function public.creator_begin_research_revision(p_owner uuid, p_project text)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare v_revision bigint;
begin
  update public.velto_projects set research_revision = research_revision + 1,
    active_research_snapshot_digest = null
    where id::text = p_project and owner_user_id = p_owner and flow_type = 'creator_lab'
    returning research_revision into v_revision;
  if not found then raise exception 'RESEARCH_PROJECT_UNAUTHORIZED'; end if;
  return v_revision;
end $$;
revoke all on function public.creator_begin_research_revision(uuid,text) from public, anon, authenticated;
grant execute on function public.creator_begin_research_revision(uuid,text) to service_role;

create function public.creator_activate_research_snapshot(p_owner uuid, p_project text, p_revision bigint, p_parent text, p_snapshot jsonb)
returns text language plpgsql security invoker set search_path = '' as $$
declare v_revision bigint; v_active text; v_digest text;
begin
  select research_revision, active_research_snapshot_digest into v_revision, v_active
    from public.velto_projects where id::text = p_project and owner_user_id = p_owner and flow_type = 'creator_lab' for update;
  if not found then raise exception 'RESEARCH_PROJECT_UNAUTHORIZED'; end if;
  if v_revision <> p_revision then raise exception 'RESEARCH_REVISION_STALE'; end if;
  if v_active is distinct from p_parent then raise exception 'RESEARCH_PARENT_STALE'; end if;
  v_digest := p_snapshot->>'snapshot_digest';
  if p_snapshot->>'owner_user_id' is distinct from p_owner::text or p_snapshot->>'project_id' is distinct from p_project or v_digest !~ '^[0-9a-f]{64}$' or p_snapshot->>'parent_snapshot_digest' is distinct from p_parent then raise exception 'RESEARCH_SNAPSHOT_INVALID'; end if;
  insert into public.creator_source_authority_snapshots (owner_user_id,project_id,snapshot_digest,editorial_context,parent_snapshot_digest,original_research_graph,initial_research_graph,research_graph_digest,research_revision)
  values (p_owner,p_project,v_digest,p_snapshot->'editorial_context',p_parent,p_snapshot->'original_research_graph',p_snapshot->'initial_research_graph',p_snapshot->>'research_graph_digest',p_revision);
  update public.velto_projects set active_research_snapshot_digest = v_digest
    where id::text = p_project and owner_user_id = p_owner;
  return v_digest;
end $$;
revoke all on function public.creator_activate_research_snapshot(uuid,text,bigint,text,jsonb) from public, anon, authenticated;
grant execute on function public.creator_activate_research_snapshot(uuid,text,bigint,text,jsonb) to service_role;

-- Protect server-owned fields and invalidate on changes to persisted research
-- brief identity. Duration, audio, scenes and other unrelated saves are excluded.
create function public.creator_guard_research_identity()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare old_brief jsonb; new_brief jsonb; old_identity jsonb; new_identity jsonb;
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if (tg_op = 'INSERT' and (new.research_revision <> 0 or new.active_research_snapshot_digest is not null)) or
       (tg_op = 'UPDATE' and (new.research_revision is distinct from old.research_revision or new.active_research_snapshot_digest is distinct from old.active_research_snapshot_digest)) then
      raise exception 'RESEARCH_AUTHORITY_SERVER_ONLY';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.flow_type = 'creator_lab' then
    old_brief := coalesce(old.exported_movie_result->'creatorProjectState'->'brief', '{}'::jsonb);
    new_brief := coalesce(new.exported_movie_result->'creatorProjectState'->'brief', '{}'::jsonb);
    old_identity := jsonb_build_array(old_brief->'topic',old_brief->'language',old_brief->'country',old_brief->'ageGroup',old_brief->'contentType',old_brief->'narrativePolicy',old_brief->'outcome',old_brief->'format');
    new_identity := jsonb_build_array(new_brief->'topic',new_brief->'language',new_brief->'country',new_brief->'ageGroup',new_brief->'contentType',new_brief->'narrativePolicy',new_brief->'outcome',new_brief->'format');
    if old_identity is distinct from new_identity or old.owner_user_id is distinct from new.owner_user_id or old.flow_type is distinct from new.flow_type then
      new.research_revision := greatest(old.research_revision + 1, new.research_revision);
      new.active_research_snapshot_digest := null;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.creator_guard_research_identity() from public, anon, authenticated;
create trigger creator_project_research_identity_guard before insert or update on public.velto_projects for each row execute function public.creator_guard_research_identity();
