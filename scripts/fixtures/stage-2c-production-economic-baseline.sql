create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table auth.users(id uuid primary key);

create table public.velto_projects (
  id uuid primary key, owner_user_id uuid not null references auth.users(id), flow_type text not null,
  updated_at timestamptz not null, exported_movie_url text, exported_movie_result jsonb, export_signature text
);
create table public.velto_media_assets (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id),
  bucket text not null, storage_path text not null, public_url text, media_kind text not null,
  mime_type text, size_bytes bigint not null, lifecycle_state text not null default 'active',
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(bucket, storage_path)
);
create unique index velto_media_assets_public_url_idx on public.velto_media_assets(public_url) where public_url is not null;
create table public.velto_media_asset_references (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id),
  asset_id uuid not null references public.velto_media_assets(id), project_id uuid not null references public.velto_projects(id),
  reference_type text not null, reference_key text not null, created_at timestamptz not null default now(),
  unique(project_id,asset_id,reference_type,reference_key)
);
create table public.velto_storage_admissions (
  id uuid primary key, owner_user_id uuid not null references auth.users(id), media_kind text not null,
  purpose text not null, project_reference text, created_at timestamptz not null default now(),
  expires_at timestamptz not null, consumed_at timestamptz, consumption_started_at timestamptz,
  consumption_token uuid, metadata jsonb not null default '{}'::jsonb
);
grant usage on schema public,auth to anon,authenticated,service_role;
grant all on all tables in schema public to service_role;
grant select on auth.users to service_role;
