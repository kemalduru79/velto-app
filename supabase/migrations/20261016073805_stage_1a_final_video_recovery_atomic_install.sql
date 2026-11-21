begin;

create or replace function public.velto_install_recovered_creator_final_video(
  p_owner_user_id uuid, p_project_id uuid, p_expected_updated_at timestamptz,
  p_public_url text, p_exported_movie_result jsonb, p_export_signature text,
  p_storage_bucket text, p_storage_path text, p_size_bytes bigint, p_references jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project public.velto_projects;
  v_asset public.velto_media_assets;
  v_expected_path text;
  v_installed_updated_at timestamptz := clock_timestamp();
begin
  if p_expected_updated_at is null then raise exception 'RECOVERY_PROJECT_REVISION_REQUIRED'; end if;
  if coalesce(trim(p_public_url), '') = '' or coalesce(trim(p_export_signature), '') = ''
      or jsonb_typeof(p_exported_movie_result) is distinct from 'object'
      or jsonb_typeof(p_references) is distinct from 'array' then
    raise exception 'RECOVERY_INPUT_INVALID';
  end if;

  v_expected_path := 'creator/' || p_owner_user_id::text || '/final/' || p_project_id::text ||
    '/254ad9e4-213d-4f44-b8e5-4dddf7da4f7d.mp4';
  if p_storage_bucket is distinct from 'movies' or p_storage_path is distinct from v_expected_path
      or p_size_bytes is distinct from 78826528 then
    raise exception 'RECOVERY_ARTIFACT_NOT_PINNED';
  end if;

  select * into v_project from public.velto_projects
  where id = p_project_id and owner_user_id = p_owner_user_id for update;
  if not found then raise exception 'RECOVERY_PROJECT_NOT_OWNED'; end if;
  if v_project.flow_type is distinct from 'creator_lab' then raise exception 'RECOVERY_PROJECT_FLOW_INVALID'; end if;
  if not exists (
    select 1 from public.velto_storage_admissions admission
    where admission.owner_user_id = p_owner_user_id
      and admission.media_kind = 'video'
      and admission.purpose = 'final_movie_export'
      and admission.project_reference = p_project_id::text
      and admission.consumed_at is not null
  ) then raise exception 'RECOVERY_STORAGE_ADMISSION_INVALID'; end if;

  select * into v_asset from public.velto_media_assets
  where bucket = p_storage_bucket and storage_path = p_storage_path for update;
  if found then
    if v_asset.owner_user_id is distinct from p_owner_user_id or v_asset.public_url is distinct from p_public_url
        or v_asset.media_kind is distinct from 'final_video' or v_asset.mime_type is distinct from 'video/mp4'
        or v_asset.size_bytes is distinct from p_size_bytes or v_asset.lifecycle_state is distinct from 'active'
        or v_asset.metadata->>'projectId' is distinct from p_project_id::text then
      raise exception 'RECOVERY_ASSET_CONFLICT';
    end if;
  else
    insert into public.velto_media_assets(
      owner_user_id, bucket, storage_path, public_url, media_kind, mime_type, size_bytes, lifecycle_state, metadata
    ) values (
      p_owner_user_id, p_storage_bucket, p_storage_path, p_public_url, 'final_video', 'video/mp4',
      p_size_bytes, 'active', jsonb_build_object('projectId', p_project_id::text)
    ) returning * into v_asset;
  end if;

  if not exists (
    select 1 from jsonb_to_recordset(p_references) as requested(url text, reference_type text, reference_key text)
    where requested.url = p_public_url and requested.reference_type = 'final_video'
      and requested.reference_key = 'project:final-video'
  ) then raise exception 'RECOVERY_FINAL_REFERENCE_REQUIRED'; end if;
  if v_project.exported_movie_url is not distinct from p_public_url
      and v_project.exported_movie_result is not distinct from p_exported_movie_result
      and v_project.export_signature is not distinct from p_export_signature
      and exists (
        select 1 from public.velto_media_asset_references reference
        where reference.owner_user_id = p_owner_user_id
          and reference.project_id = p_project_id
          and reference.asset_id = v_asset.id
          and reference.reference_type = 'final_video'
          and reference.reference_key = 'project:final-video'
      ) then
    return jsonb_build_object('status', 'already_recovered', 'project', to_jsonb(v_project), 'assetId', v_asset.id);
  end if;
  if v_project.updated_at is distinct from p_expected_updated_at then raise exception 'RECOVERY_PROJECT_STALE'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_references) as requested(url text, reference_type text, reference_key text)
    join public.velto_media_assets asset on asset.public_url = requested.url
    where asset.owner_user_id <> p_owner_user_id or asset.lifecycle_state <> 'active'
  ) then raise exception 'RECOVERY_MEDIA_REFERENCE_INVALID'; end if;

  update public.velto_projects set exported_movie_url = p_public_url,
    exported_movie_result = p_exported_movie_result, export_signature = p_export_signature,
    updated_at = v_installed_updated_at
  where id = p_project_id and owner_user_id = p_owner_user_id and updated_at = p_expected_updated_at
  returning * into v_project;
  if not found then raise exception 'RECOVERY_PROJECT_CAS_FAILED'; end if;

  delete from public.velto_media_asset_references
  where project_id = p_project_id and owner_user_id = p_owner_user_id;
  insert into public.velto_media_asset_references(owner_user_id, asset_id, project_id, reference_type, reference_key)
  select distinct p_owner_user_id, asset.id, p_project_id, requested.reference_type, requested.reference_key
  from jsonb_to_recordset(p_references) as requested(url text, reference_type text, reference_key text)
  join public.velto_media_assets asset on asset.public_url = requested.url
    and asset.owner_user_id = p_owner_user_id and asset.lifecycle_state = 'active'
  where requested.reference_type in (
    'scene_image', 'scene_video', 'asset_history', 'narration_audio',
    'dialogue_audio', 'thumbnail', 'final_video', 'other'
  ) and length(trim(requested.reference_key)) > 0;

  return jsonb_build_object('status', 'recovered', 'project', to_jsonb(v_project), 'assetId', v_asset.id);
end;
$$;

revoke all on function public.velto_install_recovered_creator_final_video(
  uuid, uuid, timestamptz, text, jsonb, text, text, text, bigint, jsonb
) from public, anon, authenticated;
grant execute on function public.velto_install_recovered_creator_final_video(
  uuid, uuid, timestamptz, text, jsonb, text, text, text, bigint, jsonb
) to service_role;

commit;
