create table if not exists public.creator_music_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- velto_projects is legacy/external to this repository's migrations and its
  -- identifier is exposed as a string. Keep the compatible type here rather
  -- than guessing a UUID foreign key.
  project_id text not null check (char_length(project_id) between 1 and 128),
  provider_key text not null check (char_length(provider_key) between 1 and 64),
  track_id text not null check (
    char_length(track_id) between 1 and 128
    and track_id ~ '^[A-Za-z0-9][A-Za-z0-9._~:-]*$'
  ),
  license_policy_version text not null check (char_length(license_policy_version) between 1 and 80),
  status text not null default 'pending' check (status in ('pending', 'acquired', 'failed', 'revoked')),
  storage_bucket text,
  storage_path text,
  content_type text,
  size_bytes bigint check (size_bytes is null or size_bytes > 0),
  checksum text check (checksum is null or checksum ~ '^[a-f0-9]{64}$'),
  provider_acquisition_id text check (provider_acquisition_id is null or char_length(provider_acquisition_id) <= 160),
  provider_license_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  acquired_at timestamptz,
  constraint creator_music_entitlements_identity_key unique (
    user_id, project_id, provider_key, track_id, license_policy_version
  ),
  constraint creator_music_entitlements_acquired_asset_check check (
    status <> 'acquired' or (
      storage_bucket is not null and storage_path is not null
      and content_type = 'audio/mpeg' and size_bytes is not null
      and checksum is not null and acquired_at is not null
    )
  )
);

create index if not exists creator_music_entitlements_owner_project_idx
  on public.creator_music_entitlements (user_id, project_id, updated_at desc);

alter table public.creator_music_entitlements enable row level security;

revoke all on table public.creator_music_entitlements from anon;
revoke all on table public.creator_music_entitlements from authenticated;
grant all on table public.creator_music_entitlements to service_role;
