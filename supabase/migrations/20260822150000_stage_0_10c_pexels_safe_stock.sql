begin;

create table if not exists public.velto_stock_search_cache (
  cache_key text primary key check (cache_key ~ '^[0-9a-f]{64}$'),
  provider text not null check (provider = 'pexels'),
  media_type text not null check (media_type in ('photo', 'video')),
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists velto_stock_search_cache_expiry_idx on public.velto_stock_search_cache(expires_at);

create table if not exists public.velto_stock_imports (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  project_id uuid not null references public.velto_projects(id) on delete cascade,
  asset_id uuid not null references public.velto_media_assets(id) on delete restrict,
  provider text not null check (provider = 'pexels'),
  provider_media_id text not null check (length(trim(provider_media_id)) > 0),
  rendition_id text not null check (length(trim(rendition_id)) > 0),
  reuse_identity text not null check (reuse_identity ~ '^[0-9a-f]{64}$'),
  public_url text not null,
  source_metadata jsonb not null,
  created_at timestamptz not null default now(),
  unique(owner_user_id, project_id, reuse_identity)
);
create index if not exists velto_stock_imports_asset_owner_idx on public.velto_stock_imports(asset_id, owner_user_id);

alter table public.velto_stock_search_cache enable row level security;
alter table public.velto_stock_imports enable row level security;
revoke all on table public.velto_stock_search_cache, public.velto_stock_imports from public, anon, authenticated;
grant all on table public.velto_stock_search_cache, public.velto_stock_imports to service_role;

-- Service-role-only cache cleanup; deployment operations may call it periodically.
create or replace function public.velto_delete_expired_stock_search_cache() returns bigint
language plpgsql security definer set search_path = '' as $$
declare deleted_count bigint;
begin
  delete from public.velto_stock_search_cache where expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
revoke all on function public.velto_delete_expired_stock_search_cache() from public, anon, authenticated;
grant execute on function public.velto_delete_expired_stock_search_cache() to service_role;

commit;
