begin;

create or replace function public.velto_creator_script_build_persist(
  p_owner_user_id uuid,
  p_build_id uuid,
  p_expected_project_revision timestamptz,
  p_installed_project_revision timestamptz,
  p_creator_project_state jsonb,
  p_invalidate_production boolean,
  p_persistence_checkpoint jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_build public.velto_creator_script_builds%rowtype;
  v_project public.velto_projects%rowtype;
  v_accepted_script jsonb;
  v_previous_script jsonb;
  v_previous_script_revision integer;
  v_scene_count integer := 0;
  v_has_meaningful_production boolean := false;
  v_snapshot_id uuid;
  v_mutation_id text;
  v_failure jsonb;
begin
  if p_owner_user_id is null or p_build_id is null then
    raise exception 'CREATOR_SCRIPT_BUILD_PERSISTENCE_INPUT_INVALID';
  end if;
  if p_expected_project_revision is null
      or p_installed_project_revision is null
      or p_installed_project_revision <= p_expected_project_revision
      or p_invalidate_production is null then
    raise exception 'CREATOR_SCRIPT_BUILD_PERSISTENCE_REVISION_INVALID';
  end if;
  if jsonb_typeof(p_creator_project_state) is distinct from 'object'
      or p_creator_project_state->>'version' is distinct from '1' then
    raise exception 'CREATOR_SCRIPT_BUILD_PERSISTENCE_PROJECT_STATE_INVALID';
  end if;
  if jsonb_typeof(p_persistence_checkpoint) is distinct from 'object'
      or p_persistence_checkpoint->>'stage' is distinct from 'persistence'
      or p_persistence_checkpoint->>'status' is distinct from 'COMPLETED'
      or p_persistence_checkpoint->>'contractVersion'
        is distinct from 'creator-script-build-persistence-checkpoint-v1'
      or coalesce(p_persistence_checkpoint->>'checkpointId', '')
        !~ '^creator-script-build-checkpoint-v1:[0-9a-f]{64}$'
      or p_persistence_checkpoint->>'operationId' is not null
      or p_persistence_checkpoint #>> '{outputReference,version}'
        is distinct from '0.19E4-persistence-checkpoint-output-v1'
      or p_persistence_checkpoint #>> '{outputReference,result,version}'
        is distinct from '0.19E4-persistence-result-v1'
      or p_persistence_checkpoint #>> '{outputReference,result,contractVersions,coordinator}'
        is distinct from '0.19E4'
      or p_persistence_checkpoint #>> '{outputReference,result,contractVersions,checkpoint}'
        is distinct from 'creator-script-build-persistence-checkpoint-v1' then
    raise exception 'CREATOR_SCRIPT_BUILD_PERSISTENCE_CHECKPOINT_INVALID';
  end if;

  select *
  into v_build
  from public.velto_creator_script_builds
  where id = p_build_id
    and owner_user_id = p_owner_user_id
  for update;

  if not found then
    raise exception 'CREATOR_SCRIPT_BUILD_NOT_OWNED';
  end if;

  if v_build.state = 'PERSISTED' then
    select *
    into v_project
    from public.velto_projects
    where id = v_build.project_id
      and owner_user_id = p_owner_user_id;

    if not found then
      raise exception 'CREATOR_SCRIPT_BUILD_PERSISTED_PROJECT_MISSING';
    end if;

    return jsonb_build_object(
      'status', 'PERSISTED',
      'build', to_jsonb(v_build),
      'project', to_jsonb(v_project)
    );
  end if;

  if v_build.state is distinct from 'ACCEPTED' then
    raise exception 'CREATOR_SCRIPT_BUILD_PERSISTENCE_STATE_INVALID';
  end if;
  if v_build.expected_project_revision is distinct from p_expected_project_revision
      or v_build.snapshot->>'expectedProjectRevision' is null
      or (v_build.snapshot->>'expectedProjectRevision')::timestamptz
        is distinct from p_expected_project_revision then
    raise exception 'CREATOR_SCRIPT_BUILD_PERSISTENCE_AUTHORITY_INVALID';
  end if;
  if v_build.snapshot #>> '{contractVersions,creatorScriptBuildPersistenceCoordinator}'
      is distinct from '0.19E4' then
    raise exception 'CREATOR_SCRIPT_BUILD_PERSISTENCE_CONTRACT_MISMATCH';
  end if;
  if v_build.result_authority is null
      or v_build.result_authority->>'version'
        is distinct from '0.19E3C-accepted-result-authority-v1'
      or v_build.result_authority #>> '{acceptance,outcome}'
        is distinct from 'ACCEPTED'
      or coalesce(
        (v_build.result_authority #>> '{acceptance,report,accepted}')::boolean,
        false
      ) is distinct from true
      or v_build.result_authority #>> '{acceptance,report,version}'
        is distinct from '0.19D' then
    raise exception 'CREATOR_SCRIPT_BUILD_ACCEPTED_RESULT_AUTHORITY_INVALID';
  end if;

  v_accepted_script := v_build.result_authority #> '{acceptance,script}';
  if jsonb_typeof(v_accepted_script) is distinct from 'object'
      or v_accepted_script->>'strategyFingerprint'
        is distinct from v_build.strategy_fingerprint
      or nullif(v_accepted_script->>'targetDurationSec', '')::integer
        is distinct from v_build.requested_duration_seconds
      or v_accepted_script->'approval' is distinct from 'null'::jsonb then
    raise exception 'CREATOR_SCRIPT_BUILD_ACCEPTED_SCRIPT_INVALID';
  end if;

  if p_creator_project_state #> '{strategy,script}' is distinct from v_accepted_script
      or p_creator_project_state #>> '{strategy,strategyFingerprint}'
        is distinct from v_build.strategy_fingerprint
      or p_creator_project_state #> '{strategy,pendingRefinement}'
        is distinct from 'null'::jsonb
      or jsonb_array_length(
        coalesce(
          p_creator_project_state #> '{strategy,revisionHistory}',
          '[]'::jsonb
        )
      ) <> 0 then
    raise exception 'CREATOR_SCRIPT_BUILD_PERSISTENCE_PROJECT_STATE_MISMATCH';
  end if;

  if p_persistence_checkpoint #>> '{outputReference,result,buildId}'
      is distinct from v_build.id::text
      or p_persistence_checkpoint #>> '{outputReference,result,projectId}'
        is distinct from v_build.project_id::text
      or (
        p_persistence_checkpoint
          #>> '{outputReference,result,previousProjectRevision}'
      )::timestamptz is distinct from p_expected_project_revision
      or (
        p_persistence_checkpoint
          #>> '{outputReference,result,installedProjectRevision}'
      )::timestamptz is distinct from p_installed_project_revision
      or nullif(
        p_persistence_checkpoint #>> '{outputReference,result,scriptRevision}',
        ''
      )::integer is distinct from nullif(v_accepted_script->>'revision', '')::integer
      or p_persistence_checkpoint #>> '{outputReference,result,strategyFingerprint}'
        is distinct from v_build.strategy_fingerprint
      or coalesce(
        (
          p_persistence_checkpoint
            #>> '{outputReference,result,invalidatedProduction}'
        )::boolean,
        false
      ) is distinct from p_invalidate_production
      or p_persistence_checkpoint #>> '{outputReference,result,acceptedAuthorityVersion}'
        is distinct from v_build.result_authority->>'version' then
    raise exception 'CREATOR_SCRIPT_BUILD_PERSISTENCE_CHECKPOINT_MISMATCH';
  end if;

  if p_invalidate_production then
    if jsonb_array_length(
        coalesce(p_creator_project_state #> '{production,refinedScenes}', '[]'::jsonb)
      ) <> 0
      or jsonb_array_length(
        coalesce(p_creator_project_state #> '{createReview,scenes}', '[]'::jsonb)
      ) <> 0
      or coalesce(
        (
          p_creator_project_state
            #>> '{publish,packageDownloaded}'
        )::boolean,
        false
      )
      or coalesce(p_creator_project_state #>> '{publish,packageSignature}', '') <> ''
      or coalesce(p_creator_project_state #>> '{publish,finalVideoUrl}', '') <> ''
      or coalesce(p_creator_project_state #>> '{publish,finalVideoSignature}', '') <> '' then
      raise exception 'CREATOR_SCRIPT_BUILD_PRODUCTION_INVALIDATION_INVALID';
    end if;
  end if;

  select *
  into v_project
  from public.velto_projects
  where id = v_build.project_id
    and owner_user_id = p_owner_user_id
  for update;

  if not found then
    raise exception 'CREATOR_SCRIPT_BUILD_PROJECT_NOT_OWNED';
  end if;
  if v_project.flow_type is distinct from 'creator_lab' then
    raise exception 'CREATOR_SCRIPT_BUILD_PROJECT_FLOW_INVALID';
  end if;

  if v_project.updated_at is distinct from p_expected_project_revision then
    v_failure := jsonb_build_object(
      'category', 'AUTHORITY',
      'code', 'CREATOR_SCRIPT_BUILD_PROJECT_STALE',
      'stage', 'persistence',
      'retryability', 'NON_RETRYABLE',
      'operationId', null,
      'diagnostics', '{}'::jsonb
    );

    update public.velto_creator_script_builds
    set state = 'STALE',
        failure = v_failure,
        result_authority = null
    where id = v_build.id
      and owner_user_id = p_owner_user_id
      and state = 'ACCEPTED'
    returning * into v_build;

    return jsonb_build_object(
      'status', 'STALE',
      'build', to_jsonb(v_build),
      'project', to_jsonb(v_project)
    );
  end if;

  v_previous_script :=
    v_project.exported_movie_result #> '{creatorProjectState,strategy,script}';

  if p_invalidate_production
      and jsonb_typeof(v_previous_script) = 'object'
      and nullif(v_previous_script->>'revision', '') is not null then
    v_previous_script_revision :=
      nullif(v_previous_script->>'revision', '')::integer;

    v_scene_count := greatest(
      jsonb_array_length(coalesce(v_project.scenes, '[]'::jsonb)),
      jsonb_array_length(coalesce(v_project.refined_creator_scenes, '[]'::jsonb)),
      jsonb_array_length(coalesce(v_project.creator_production_package->'scenes', '[]'::jsonb)),
      jsonb_array_length(coalesce(
        v_project.exported_movie_result
          #> '{creatorProjectState,createReview,scenes}',
        '[]'::jsonb
      )),
      jsonb_array_length(coalesce(
        v_project.exported_movie_result
          #> '{creatorProjectState,production,refinedScenes}',
        '[]'::jsonb
      ))
    );

    v_has_meaningful_production :=
      v_scene_count > 0
      or jsonb_array_length(coalesce(
        v_project.exported_movie_result
          #> '{creatorProjectState,production,audioTimeline,placements}',
        '[]'::jsonb
      )) > 0
      or length(trim(coalesce(v_project.exported_movie_url, ''))) > 0
      or length(trim(coalesce(v_project.export_signature, ''))) > 0;

    if v_has_meaningful_production then
      v_mutation_id :=
        'creator-script-build-persist-v1:' || v_build.id::text;

      insert into public.velto_creator_production_snapshots(
        owner_user_id,
        project_id,
        source_script_revision,
        script_fingerprint,
        approval_fingerprint,
        mutation_id,
        invalidation_reason,
        scene_count,
        has_final_video,
        snapshot_json
      ) values (
        p_owner_user_id,
        v_project.id,
        v_previous_script_revision,
        coalesce(v_previous_script->>'strategyFingerprint', ''),
        coalesce(v_previous_script->'approval', 'null'::jsonb)::text,
        v_mutation_id,
        'creator_script_build_persisted',
        v_scene_count,
        length(trim(coalesce(v_project.exported_movie_url, ''))) > 0,
        jsonb_build_object('schemaVersion', 1, 'project', to_jsonb(v_project))
      )
      on conflict (project_id, mutation_id) do nothing
      returning id into v_snapshot_id;

      if v_snapshot_id is null then
        select id
        into v_snapshot_id
        from public.velto_creator_production_snapshots
        where project_id = v_project.id
          and mutation_id = v_mutation_id;
      end if;

      if v_snapshot_id is not null then
        insert into public.velto_creator_production_snapshot_media_refs(
          snapshot_id,
          owner_user_id,
          project_id,
          asset_id,
          reference_type,
          reference_key
        )
        select
          v_snapshot_id,
          reference.owner_user_id,
          reference.project_id,
          reference.asset_id,
          reference.reference_type,
          reference.reference_key
        from public.velto_media_asset_references reference
        join public.velto_media_assets asset
          on asset.id = reference.asset_id
          and asset.owner_user_id = p_owner_user_id
          and asset.lifecycle_state = 'active'
        where reference.project_id = v_project.id
          and reference.owner_user_id = p_owner_user_id
        on conflict (
          snapshot_id,
          asset_id,
          reference_type,
          reference_key
        ) do nothing;
      end if;
    end if;
  end if;

  update public.velto_projects
  set exported_movie_result =
        coalesce(exported_movie_result, '{}'::jsonb)
        || jsonb_build_object(
          'creatorProjectState',
          p_creator_project_state
        ),
      scenes = case
        when p_invalidate_production then '[]'::jsonb
        else scenes
      end,
      refined_creator_scenes = case
        when p_invalidate_production then '[]'::jsonb
        else refined_creator_scenes
      end,
      exported_movie_url = case
        when p_invalidate_production then null
        else exported_movie_url
      end,
      export_signature = case
        when p_invalidate_production then null
        else export_signature
      end,
      updated_at = p_installed_project_revision
  where id = v_project.id
    and owner_user_id = p_owner_user_id
    and updated_at = p_expected_project_revision
  returning * into v_project;

  if not found then
    raise exception 'CREATOR_SCRIPT_BUILD_PROJECT_CAS_FAILED';
  end if;

  update public.velto_creator_script_builds
  set checkpoints = jsonb_set(
        checkpoints,
        array['persistence'],
        p_persistence_checkpoint,
        true
      ),
      state = 'PERSISTED',
      failure = null
  where id = v_build.id
    and owner_user_id = p_owner_user_id
    and state = 'ACCEPTED'
  returning * into v_build;

  if not found then
    raise exception 'CREATOR_SCRIPT_BUILD_PERSISTED_TRANSITION_FAILED';
  end if;

  return jsonb_build_object(
    'status', 'PERSISTED',
    'build', to_jsonb(v_build),
    'project', to_jsonb(v_project)
  );
end;
$$;

revoke all on function public.velto_creator_script_build_persist(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  jsonb,
  boolean,
  jsonb
) from public, anon, authenticated;

grant execute on function public.velto_creator_script_build_persist(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  jsonb,
  boolean,
  jsonb
) to service_role;

commit;
