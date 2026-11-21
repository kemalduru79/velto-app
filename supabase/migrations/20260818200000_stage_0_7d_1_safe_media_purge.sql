begin;

alter table public.velto_media_assets
  add column if not exists purge_started_at timestamptz,
  add column if not exists purge_token uuid;

create unique index if not exists velto_media_assets_purge_token_idx
  on public.velto_media_assets(purge_token) where purge_token is not null;

alter table public.velto_media_assets
  drop constraint if exists velto_media_assets_purge_coordination_check;
alter table public.velto_media_assets
  add constraint velto_media_assets_purge_coordination_check check (
    (purge_started_at is null and purge_token is null) or
    (lifecycle_state = 'trashed' and purge_started_at is not null and purge_token is not null)
  );

create or replace function public.velto_begin_media_asset_purge(
  p_owner_user_id uuid,
  p_asset_id uuid,
  p_retention_days integer
) returns table(
  status text,
  asset_id uuid,
  bucket text,
  storage_path text,
  purge_token uuid,
  size_bytes bigint,
  media_kind text,
  trashed_at timestamptz,
  eligible_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset public.velto_media_assets%rowtype;
  v_token uuid;
  v_eligible_at timestamptz;
begin
  if p_retention_days < 0 then raise exception 'INVALID_RETENTION'; end if;
  select * into v_asset from public.velto_media_assets
  where id = p_asset_id and owner_user_id = p_owner_user_id
  for update;
  if not found then
    return query select 'not_found'::text, null::uuid, null::text, null::text, null::uuid, null::bigint, null::text, null::timestamptz, null::timestamptz;
    return;
  end if;
  if v_asset.lifecycle_state <> 'trashed' or v_asset.trashed_at is null then
    return query select 'not_trashed'::text, null::uuid, null::text, null::text, null::uuid, null::bigint, null::text, v_asset.trashed_at, null::timestamptz;
    return;
  end if;
  if v_asset.purge_started_at is not null or v_asset.purge_token is not null then
    return query select 'purge_already_pending'::text, null::uuid, null::text, null::text, null::uuid, null::bigint, null::text, v_asset.trashed_at, null::timestamptz;
    return;
  end if;
  v_eligible_at := v_asset.trashed_at + make_interval(days => p_retention_days);
  if v_eligible_at > now() then
    return query select 'retention_not_met'::text, null::uuid, null::text, null::text, null::uuid, null::bigint, null::text, v_asset.trashed_at, v_eligible_at;
    return;
  end if;
  if exists (
    select 1 from public.velto_media_asset_references
    where asset_id = p_asset_id and owner_user_id = p_owner_user_id
  ) then
    return query select 'in_use'::text, null::uuid, null::text, null::text, null::uuid, null::bigint, null::text, v_asset.trashed_at, v_eligible_at;
    return;
  end if;
  v_token := gen_random_uuid();
  update public.velto_media_assets
  set purge_started_at = now(), purge_token = v_token, updated_at = now()
  where id = p_asset_id and owner_user_id = p_owner_user_id;
  return query select 'ready'::text, v_asset.id, v_asset.bucket, v_asset.storage_path,
    v_token, v_asset.size_bytes, v_asset.media_kind, v_asset.trashed_at, v_eligible_at;
end;
$$;

create or replace function public.velto_complete_media_asset_purge(
  p_owner_user_id uuid,
  p_asset_id uuid,
  p_purge_token uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_asset public.velto_media_assets%rowtype;
begin
  select * into v_asset from public.velto_media_assets
  where id = p_asset_id and owner_user_id = p_owner_user_id
  for update;
  if not found then return 'not_found'; end if;
  if v_asset.lifecycle_state <> 'trashed' then return 'not_trashed'; end if;
  if v_asset.purge_started_at is null or v_asset.purge_token is distinct from p_purge_token then return 'token_mismatch'; end if;
  if exists (
    select 1 from public.velto_media_asset_references
    where asset_id = p_asset_id and owner_user_id = p_owner_user_id
  ) then return 'in_use'; end if;
  update public.velto_media_assets
  set lifecycle_state = 'purged', purged_at = now(), purge_started_at = null,
    purge_token = null, updated_at = now()
  where id = p_asset_id and owner_user_id = p_owner_user_id;
  return 'purged';
end;
$$;

create or replace function public.velto_abort_media_asset_purge(
  p_owner_user_id uuid,
  p_asset_id uuid,
  p_purge_token uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_asset public.velto_media_assets%rowtype;
begin
  select * into v_asset from public.velto_media_assets
  where id = p_asset_id and owner_user_id = p_owner_user_id
  for update;
  if not found then return 'not_found'; end if;
  if v_asset.lifecycle_state <> 'trashed' then return 'not_trashed'; end if;
  if v_asset.purge_started_at is null or v_asset.purge_token is distinct from p_purge_token then return 'token_mismatch'; end if;
  update public.velto_media_assets
  set purge_started_at = null, purge_token = null, updated_at = now()
  where id = p_asset_id and owner_user_id = p_owner_user_id;
  return 'aborted';
end;
$$;

create or replace function public.velto_restore_media_asset(
  p_owner_user_id uuid,
  p_asset_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_asset public.velto_media_assets%rowtype;
begin
  select * into v_asset from public.velto_media_assets
  where id = p_asset_id and owner_user_id = p_owner_user_id
  for update;
  if not found then return 'not_found'; end if;
  if v_asset.lifecycle_state <> 'trashed' then return 'state_changed'; end if;
  if v_asset.purge_started_at is not null or v_asset.purge_token is not null then return 'purge_pending'; end if;
  update public.velto_media_assets
  set lifecycle_state = 'active', trashed_at = null, updated_at = now()
  where id = p_asset_id and owner_user_id = p_owner_user_id;
  return 'restored';
end;
$$;

revoke all on function public.velto_begin_media_asset_purge(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.velto_begin_media_asset_purge(uuid, uuid, integer) to service_role;
revoke all on function public.velto_complete_media_asset_purge(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.velto_complete_media_asset_purge(uuid, uuid, uuid) to service_role;
revoke all on function public.velto_abort_media_asset_purge(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.velto_abort_media_asset_purge(uuid, uuid, uuid) to service_role;
revoke all on function public.velto_restore_media_asset(uuid, uuid) from public, anon, authenticated;
grant execute on function public.velto_restore_media_asset(uuid, uuid) to service_role;

commit;
