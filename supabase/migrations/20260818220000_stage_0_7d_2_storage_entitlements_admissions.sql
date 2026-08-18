begin;

create table if not exists public.velto_storage_entitlements (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  bytes_granted bigint not null check (bytes_granted > 0),
  status text not null check (status in ('active', 'revoked')),
  source text not null check (source in ('manual', 'payment_provider', 'promotion', 'migration')),
  external_reference text,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (external_reference is null or length(trim(external_reference)) > 0),
  check (expires_at is null or expires_at > starts_at),
  check (
    (status = 'active' and revoked_at is null) or
    (status = 'revoked' and revoked_at is not null)
  )
);

create index if not exists velto_storage_entitlements_owner_active_idx
  on public.velto_storage_entitlements(owner_user_id, starts_at, expires_at)
  where status = 'active' and revoked_at is null;
create unique index if not exists velto_storage_entitlements_external_reference_idx
  on public.velto_storage_entitlements(source, external_reference)
  where external_reference is not null;

create table if not exists public.velto_storage_admissions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  media_kind text not null check (media_kind in ('image', 'video')),
  purpose text not null check (purpose in (
    'creator_generated_image',
    'storyverse_generated_image',
    'storyverse_generated_video'
  )),
  project_reference text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumption_started_at timestamptz,
  consumption_token uuid,
  consumed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  check (expires_at > created_at),
  check (project_reference is null or length(trim(project_reference)) > 0),
  check (
    (consumption_started_at is null and consumption_token is null) or
    (consumption_started_at is not null and consumption_token is not null and consumed_at is null)
  )
);

create index if not exists velto_storage_admissions_owner_open_idx
  on public.velto_storage_admissions(owner_user_id, expires_at)
  where consumed_at is null;

alter table public.velto_storage_entitlements enable row level security;
alter table public.velto_storage_admissions enable row level security;

revoke all on table public.velto_storage_entitlements from public, anon, authenticated;
revoke all on table public.velto_storage_admissions from public, anon, authenticated;
grant all on table public.velto_storage_entitlements to service_role;
grant all on table public.velto_storage_admissions to service_role;

create or replace function public.velto_get_additional_storage_bytes(
  p_owner_user_id uuid
) returns bigint
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(sum(e.bytes_granted), 0)::bigint
  from public.velto_storage_entitlements e
  where e.owner_user_id = p_owner_user_id
    and e.status = 'active'
    and e.starts_at <= now()
    and (e.expires_at is null or e.expires_at > now())
    and e.revoked_at is null;
$$;

create or replace function public.velto_begin_storage_admission_consumption(
  p_owner_user_id uuid,
  p_admission_id uuid,
  p_media_kind text,
  p_purpose text
) returns table(status text, consumption_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admission public.velto_storage_admissions%rowtype;
  v_token uuid;
begin
  select * into v_admission
  from public.velto_storage_admissions a
  where a.id = p_admission_id and a.owner_user_id = p_owner_user_id
  for update;
  if not found then return query select 'not_found'::text, null::uuid; return; end if;
  if v_admission.expires_at <= now() then return query select 'expired'::text, null::uuid; return; end if;
  if v_admission.consumed_at is not null then return query select 'consumed'::text, null::uuid; return; end if;
  if v_admission.consumption_started_at is not null or v_admission.consumption_token is not null then
    return query select 'consumption_pending'::text, null::uuid; return;
  end if;
  if v_admission.media_kind <> p_media_kind then return query select 'media_kind_mismatch'::text, null::uuid; return; end if;
  if v_admission.purpose <> p_purpose then return query select 'purpose_mismatch'::text, null::uuid; return; end if;
  v_token := gen_random_uuid();
  update public.velto_storage_admissions a
  set consumption_started_at = now(), consumption_token = v_token
  where a.id = p_admission_id and a.owner_user_id = p_owner_user_id;
  return query select 'ready'::text, v_token;
end;
$$;

create or replace function public.velto_complete_storage_admission_consumption(
  p_owner_user_id uuid,
  p_admission_id uuid,
  p_consumption_token uuid
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_admission public.velto_storage_admissions%rowtype;
begin
  select * into v_admission
  from public.velto_storage_admissions a
  where a.id = p_admission_id and a.owner_user_id = p_owner_user_id
  for update;
  if not found then return 'not_found'; end if;
  if v_admission.consumed_at is not null then return 'consumed'; end if;
  if v_admission.consumption_started_at is null or v_admission.consumption_token is distinct from p_consumption_token then return 'token_mismatch'; end if;
  update public.velto_storage_admissions a
  set consumed_at = now(), consumption_started_at = null, consumption_token = null
  where a.id = p_admission_id and a.owner_user_id = p_owner_user_id;
  return 'consumed';
end;
$$;

create or replace function public.velto_abort_storage_admission_consumption(
  p_owner_user_id uuid,
  p_admission_id uuid,
  p_consumption_token uuid
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_admission public.velto_storage_admissions%rowtype;
begin
  select * into v_admission
  from public.velto_storage_admissions a
  where a.id = p_admission_id and a.owner_user_id = p_owner_user_id
  for update;
  if not found then return 'not_found'; end if;
  if v_admission.consumed_at is not null then return 'consumed'; end if;
  if v_admission.consumption_started_at is null or v_admission.consumption_token is distinct from p_consumption_token then return 'token_mismatch'; end if;
  update public.velto_storage_admissions a
  set consumption_started_at = null, consumption_token = null
  where a.id = p_admission_id and a.owner_user_id = p_owner_user_id;
  return 'aborted';
end;
$$;

revoke all on function public.velto_get_additional_storage_bytes(uuid) from public, anon, authenticated;
grant execute on function public.velto_get_additional_storage_bytes(uuid) to service_role;
revoke all on function public.velto_begin_storage_admission_consumption(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.velto_begin_storage_admission_consumption(uuid, uuid, text, text) to service_role;
revoke all on function public.velto_complete_storage_admission_consumption(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.velto_complete_storage_admission_consumption(uuid, uuid, uuid) to service_role;
revoke all on function public.velto_abort_storage_admission_consumption(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.velto_abort_storage_admission_consumption(uuid, uuid, uuid) to service_role;

commit;
