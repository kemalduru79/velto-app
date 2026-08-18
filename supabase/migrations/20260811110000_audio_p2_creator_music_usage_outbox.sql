create table if not exists public.creator_music_usage_events (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null references public.creator_music_entitlements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null check (char_length(project_id) between 1 and 128),
  provider_key text not null check (char_length(provider_key) between 1 and 64),
  track_id text not null check (
    char_length(track_id) between 1 and 128
    and track_id ~ '^[A-Za-z0-9][A-Za-z0-9._~:-]*$'
  ),
  license_policy_version text not null check (char_length(license_policy_version) between 1 and 80),
  export_usage_key text not null check (export_usage_key ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'reported', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text check (
    last_error_code is null or last_error_code in (
      'provider_unavailable', 'provider_rate_limited', 'provider_rejected',
      'reporting_unavailable', 'unknown'
    )
  ),
  provider_usage_event_id text check (
    provider_usage_event_id is null or char_length(provider_usage_event_id) between 1 and 160
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reported_at timestamptz,
  constraint creator_music_usage_events_identity_key unique (entitlement_id, export_usage_key),
  constraint creator_music_usage_events_reported_check check (
    status <> 'reported' or reported_at is not null
  )
);

create index if not exists creator_music_usage_events_pending_idx
  on public.creator_music_usage_events (created_at, id)
  where status = 'pending';

alter table public.creator_music_usage_events enable row level security;

revoke all on table public.creator_music_usage_events from anon;
revoke all on table public.creator_music_usage_events from authenticated;
grant all on table public.creator_music_usage_events to service_role;
