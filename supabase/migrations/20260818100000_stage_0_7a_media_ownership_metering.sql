begin;

create extension if not exists pgcrypto;

create table if not exists public.velto_media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  bucket text not null check (length(trim(bucket)) > 0),
  storage_path text not null check (length(trim(storage_path)) > 0),
  public_url text,
  media_kind text not null check (media_kind in (
    'image', 'video', 'narration_audio', 'dialogue_audio',
    'final_video', 'thumbnail', 'music', 'other'
  )),
  mime_type text,
  size_bytes bigint not null check (size_bytes >= 0),
  lifecycle_state text not null default 'active'
    check (lifecycle_state in ('active', 'trashed', 'purged')),
  trashed_at timestamptz,
  purged_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, storage_path),
  check (
    (lifecycle_state = 'active' and trashed_at is null and purged_at is null) or
    (lifecycle_state = 'trashed' and trashed_at is not null and purged_at is null) or
    (lifecycle_state = 'purged' and purged_at is not null)
  )
);

create unique index if not exists velto_media_assets_public_url_idx
  on public.velto_media_assets(public_url) where public_url is not null;
create index if not exists velto_media_assets_owner_usage_idx
  on public.velto_media_assets(owner_user_id, lifecycle_state, media_kind);
create index if not exists velto_media_assets_storage_object_idx
  on public.velto_media_assets(bucket, storage_path);

create table if not exists public.velto_media_asset_references (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  asset_id uuid not null references public.velto_media_assets(id) on delete restrict,
  project_id uuid not null references public.velto_projects(id) on delete cascade,
  reference_type text not null check (reference_type in (
    'scene_image', 'scene_video', 'asset_history', 'narration_audio',
    'dialogue_audio', 'thumbnail', 'final_video', 'other'
  )),
  reference_key text not null check (length(trim(reference_key)) > 0),
  created_at timestamptz not null default now(),
  unique (project_id, asset_id, reference_type, reference_key)
);

create index if not exists velto_media_asset_references_owner_idx
  on public.velto_media_asset_references(owner_user_id, asset_id);
create index if not exists velto_media_asset_references_project_idx
  on public.velto_media_asset_references(project_id, owner_user_id);

alter table public.velto_media_assets enable row level security;
alter table public.velto_media_asset_references enable row level security;

drop policy if exists "Users can read own media assets" on public.velto_media_assets;
create policy "Users can read own media assets"
  on public.velto_media_assets for select to authenticated
  using ((select auth.uid()) = owner_user_id);

drop policy if exists "Users can read own media references" on public.velto_media_asset_references;
create policy "Users can read own media references"
  on public.velto_media_asset_references for select to authenticated
  using ((select auth.uid()) = owner_user_id);

revoke all on table public.velto_media_assets from anon, authenticated;
revoke all on table public.velto_media_asset_references from anon, authenticated;
grant select on table public.velto_media_assets to authenticated;
grant select on table public.velto_media_asset_references to authenticated;
grant all on table public.velto_media_assets to service_role;
grant all on table public.velto_media_asset_references to service_role;

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

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_references, '[]'::jsonb))
      as requested(asset_id uuid, reference_type text, reference_key text)
    left join public.velto_media_assets asset on asset.id = requested.asset_id
    where asset.id is null or asset.owner_user_id <> p_owner_user_id
  ) then
    raise exception 'MEDIA_ASSET_NOT_OWNED';
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

revoke all on function public.velto_replace_project_media_references(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.velto_replace_project_media_references(uuid, uuid, jsonb) to service_role;

commit;
