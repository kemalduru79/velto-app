begin;

create table if not exists public.velto_creator_production_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  project_id uuid not null references public.velto_projects(id) on delete cascade,
  source_script_revision integer not null check (source_script_revision > 0),
  script_fingerprint text not null,
  approval_fingerprint text not null default '',
  mutation_id text not null check (length(trim(mutation_id)) > 0),
  invalidation_reason text not null check (length(trim(invalidation_reason)) > 0),
  scene_count integer not null check (scene_count >= 0),
  has_final_video boolean not null default false,
  snapshot_json jsonb not null,
  invalidated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (project_id, mutation_id)
);

create index if not exists velto_creator_production_snapshots_owner_project_idx
  on public.velto_creator_production_snapshots(owner_user_id, project_id, created_at desc);

create table if not exists public.velto_creator_production_snapshot_media_refs (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.velto_creator_production_snapshots(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  project_id uuid not null references public.velto_projects(id) on delete cascade,
  asset_id uuid not null references public.velto_media_assets(id) on delete restrict,
  reference_type text not null,
  reference_key text not null check (length(trim(reference_key)) > 0),
  created_at timestamptz not null default now(),
  unique (snapshot_id, asset_id, reference_type, reference_key)
);

create index if not exists velto_creator_production_snapshot_media_owner_idx
  on public.velto_creator_production_snapshot_media_refs(owner_user_id, asset_id);
create index if not exists velto_creator_production_snapshot_media_project_idx
  on public.velto_creator_production_snapshot_media_refs(project_id, snapshot_id);

alter table public.velto_creator_production_snapshots enable row level security;
alter table public.velto_creator_production_snapshot_media_refs enable row level security;

create policy "Users can read own creator production snapshots"
  on public.velto_creator_production_snapshots for select to authenticated
  using ((select auth.uid()) = owner_user_id);
create policy "Users can read own creator production snapshot media"
  on public.velto_creator_production_snapshot_media_refs for select to authenticated
  using ((select auth.uid()) = owner_user_id);

revoke all on table public.velto_creator_production_snapshots from anon, authenticated;
revoke all on table public.velto_creator_production_snapshot_media_refs from anon, authenticated;
grant select on table public.velto_creator_production_snapshots to authenticated;
grant select on table public.velto_creator_production_snapshot_media_refs to authenticated;
grant all on table public.velto_creator_production_snapshots to service_role;
grant all on table public.velto_creator_production_snapshot_media_refs to service_role;

create or replace function public.velto_reject_creator_production_snapshot_update()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'CREATOR_PRODUCTION_SNAPSHOT_IMMUTABLE';
end;
$$;
create trigger velto_creator_production_snapshot_immutable
  before update on public.velto_creator_production_snapshots
  for each row execute function public.velto_reject_creator_production_snapshot_update();

create or replace function public.velto_capture_creator_production_snapshot(
  p_owner_user_id uuid,
  p_project_id uuid,
  p_expected_updated_at timestamptz,
  p_mutation_id text,
  p_invalidation_reason text,
  p_source_script_revision integer,
  p_script_fingerprint text,
  p_approval_fingerprint text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project public.velto_projects%rowtype;
  v_snapshot_id uuid;
  v_scene_count integer := 0;
  v_qualified boolean := false;
begin
  if length(trim(coalesce(p_mutation_id, ''))) = 0 then raise exception 'CREATOR_PRODUCTION_MUTATION_ID_REQUIRED'; end if;
  select * into v_project from public.velto_projects
  where id = p_project_id and owner_user_id = p_owner_user_id for update;
  if not found then raise exception 'PROJECT_NOT_OWNED'; end if;
  if v_project.flow_type is distinct from 'creator_lab' then raise exception 'PROJECT_FLOW_TYPE_MISMATCH'; end if;
  if v_project.updated_at is distinct from p_expected_updated_at then raise exception 'PROJECT_SAVE_CONFLICT'; end if;
  if nullif(v_project.exported_movie_result #>> '{creatorProjectState,strategy,script,revision}', '')::integer
      is distinct from p_source_script_revision then raise exception 'CREATOR_SCRIPT_MUTATION_STALE'; end if;

  select id into v_snapshot_id from public.velto_creator_production_snapshots
  where project_id = p_project_id and mutation_id = p_mutation_id;
  if found then return jsonb_build_object('qualified', true, 'created', false, 'snapshotId', v_snapshot_id); end if;

  v_scene_count := greatest(
    jsonb_array_length(coalesce(v_project.scenes, '[]'::jsonb)),
    jsonb_array_length(coalesce(v_project.refined_creator_scenes, '[]'::jsonb)),
    jsonb_array_length(coalesce(v_project.creator_production_package->'scenes', '[]'::jsonb)),
    jsonb_array_length(coalesce(v_project.exported_movie_result #> '{creatorProjectState,createReview,scenes}', '[]'::jsonb)),
    jsonb_array_length(coalesce(v_project.exported_movie_result #> '{creatorProjectState,production,refinedScenes}', '[]'::jsonb))
  );
  v_qualified := v_scene_count > 0
    or jsonb_array_length(coalesce(v_project.exported_movie_result #> '{creatorProjectState,production,audioTimeline,placements}', '[]'::jsonb)) > 0
    or length(trim(coalesce(v_project.exported_movie_url, ''))) > 0
    or length(trim(coalesce(v_project.export_signature, ''))) > 0;
  if not v_qualified then return jsonb_build_object('qualified', false, 'created', false, 'snapshotId', null); end if;

  insert into public.velto_creator_production_snapshots(
    owner_user_id, project_id, source_script_revision, script_fingerprint,
    approval_fingerprint, mutation_id, invalidation_reason, scene_count,
    has_final_video, snapshot_json
  ) values (
    p_owner_user_id, p_project_id, p_source_script_revision,
    coalesce(p_script_fingerprint, ''), coalesce(p_approval_fingerprint, ''),
    p_mutation_id, p_invalidation_reason, v_scene_count,
    length(trim(coalesce(v_project.exported_movie_url, ''))) > 0,
    jsonb_build_object('schemaVersion', 1, 'project', to_jsonb(v_project))
  ) returning id into v_snapshot_id;

  insert into public.velto_creator_production_snapshot_media_refs(
    snapshot_id, owner_user_id, project_id, asset_id, reference_type, reference_key
  )
  select v_snapshot_id, reference.owner_user_id, reference.project_id,
    reference.asset_id, reference.reference_type, reference.reference_key
  from public.velto_media_asset_references reference
  join public.velto_media_assets asset on asset.id = reference.asset_id
    and asset.owner_user_id = p_owner_user_id and asset.lifecycle_state = 'active'
  where reference.project_id = p_project_id and reference.owner_user_id = p_owner_user_id;

  return jsonb_build_object('qualified', true, 'created', true, 'snapshotId', v_snapshot_id);
end;
$$;

revoke all on function public.velto_capture_creator_production_snapshot(uuid, uuid, timestamptz, text, text, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.velto_capture_creator_production_snapshot(uuid, uuid, timestamptz, text, text, integer, text, text)
  to service_role;

commit;
