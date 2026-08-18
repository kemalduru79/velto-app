begin;

create or replace function public.velto_replace_project_media_references(
  p_owner_user_id uuid,
  p_project_id uuid,
  p_references jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.velto_projects
    where id = p_project_id and owner_user_id = p_owner_user_id
  ) then
    raise exception 'PROJECT_NOT_OWNED';
  end if;

  -- Serialize saved-reference creation against Trash. A save that loses this
  -- race observes the new lifecycle and fails closed instead of referencing
  -- unavailable media.
  perform 1
  from public.velto_media_assets asset
  join (
    select distinct requested.asset_id
    from jsonb_to_recordset(coalesce(p_references, '[]'::jsonb))
      as requested(asset_id uuid, reference_type text, reference_key text)
  ) requested on requested.asset_id = asset.id
  order by asset.id
  for update of asset;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_references, '[]'::jsonb))
      as requested(asset_id uuid, reference_type text, reference_key text)
    left join public.velto_media_assets asset on asset.id = requested.asset_id
    where asset.id is null
      or asset.owner_user_id <> p_owner_user_id
      or asset.lifecycle_state <> 'active'
  ) then
    raise exception 'MEDIA_ASSET_NOT_OWNED_OR_ACTIVE';
  end if;

  delete from public.velto_media_asset_references
  where project_id = p_project_id and owner_user_id = p_owner_user_id;

  insert into public.velto_media_asset_references(
    owner_user_id, asset_id, project_id, reference_type, reference_key
  )
  select distinct p_owner_user_id, requested.asset_id, p_project_id,
    requested.reference_type, requested.reference_key
  from jsonb_to_recordset(coalesce(p_references, '[]'::jsonb))
    as requested(asset_id uuid, reference_type text, reference_key text)
  where requested.reference_type in (
    'scene_image', 'scene_video', 'asset_history', 'narration_audio',
    'dialogue_audio', 'thumbnail', 'final_video', 'other'
  ) and length(trim(requested.reference_key)) > 0;
end;
$$;

create or replace function public.velto_trash_media_asset_if_unreferenced(
  p_owner_user_id uuid,
  p_asset_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_state text;
begin
  select lifecycle_state into current_state
  from public.velto_media_assets
  where id = p_asset_id and owner_user_id = p_owner_user_id
  for update;

  if not found then return 'not_found'; end if;
  if current_state <> 'active' then return 'state_changed'; end if;
  if exists (
    select 1 from public.velto_media_asset_references
    where asset_id = p_asset_id and owner_user_id = p_owner_user_id
  ) then return 'in_use'; end if;

  update public.velto_media_assets
  set lifecycle_state = 'trashed', trashed_at = now(), updated_at = now()
  where id = p_asset_id and owner_user_id = p_owner_user_id
    and lifecycle_state = 'active';
  return 'trashed';
end;
$$;

revoke all on function public.velto_replace_project_media_references(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.velto_replace_project_media_references(uuid, uuid, jsonb) to service_role;
revoke all on function public.velto_trash_media_asset_if_unreferenced(uuid, uuid) from public, anon, authenticated;
grant execute on function public.velto_trash_media_asset_if_unreferenced(uuid, uuid) to service_role;

commit;
