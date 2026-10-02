begin;

create extension if not exists pgcrypto;

create table public.velto_creator_script_builds (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  project_id uuid not null references public.velto_projects(id) on delete cascade,
  idempotency_key text not null
    check (idempotency_key ~ '^creator-script-build-idempotency-v1:[0-9a-f]{64}$'),
  expected_project_revision timestamptz not null,
  strategy_fingerprint text not null check (length(trim(strategy_fingerprint)) between 1 and 256),
  language text not null check (language in ('tr', 'en')),
  requested_duration_seconds integer not null
    check (requested_duration_seconds between 1 and 86400),
  snapshot_version text not null
    check (snapshot_version = 'creator-script-build-snapshot-v1'),
  contract_versions jsonb not null
    check (jsonb_typeof(contract_versions) = 'object' and contract_versions <> '{}'::jsonb),
  state text not null default 'REQUESTED'
    check (state in (
      'REQUESTED', 'SNAPSHOTTED', 'RESEARCH_READY', 'EDITORIAL_COMPILED',
      'AUTHORITY_RESOLVED', 'SCRIPT_GENERATED', 'REPAIRING', 'ACCEPTED',
      'PERSISTED', 'FAILED', 'STALE'
    )),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  checkpoints jsonb not null default '{}'::jsonb check (jsonb_typeof(checkpoints) = 'object'),
  failure jsonb,
  result_authority jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_user_id),
  unique (owner_user_id, idempotency_key),
  check (snapshot->>'snapshotVersion' = snapshot_version),
  check (snapshot->>'projectId' = project_id::text),
  check ((snapshot->>'expectedProjectRevision')::timestamptz = expected_project_revision),
  check (snapshot->>'strategyFingerprint' = strategy_fingerprint),
  check (snapshot->>'language' = language),
  check ((snapshot->>'requestedDurationSeconds')::integer = requested_duration_seconds),
  check (snapshot->'contractVersions' = contract_versions),
  check (
    (state in ('FAILED', 'STALE') and jsonb_typeof(failure) = 'object')
    or (state not in ('FAILED', 'STALE') and failure is null)
  ),
  check (result_authority is null or state in ('ACCEPTED', 'PERSISTED'))
);

create index velto_creator_script_builds_owner_project_idx
  on public.velto_creator_script_builds(owner_user_id, project_id, created_at desc);
create index velto_creator_script_builds_active_idx
  on public.velto_creator_script_builds(owner_user_id, updated_at desc)
  where state not in ('PERSISTED', 'FAILED', 'STALE');

create table public.velto_creator_script_build_operations (
  id uuid primary key default gen_random_uuid(),
  operation_identity text not null unique
    check (operation_identity ~ '^creator-script-build-operation-v1:[0-9a-f]{64}$'),
  build_id uuid not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  stage text not null
    check (stage in ('research', 'editorial', 'authority', 'script_generation', 'repair', 'acceptance', 'persistence')),
  operation_type text not null check (length(trim(operation_type)) between 1 and 160),
  semantic_fingerprint text not null check (length(trim(semantic_fingerprint)) between 1 and 256),
  contract_version text not null check (length(trim(contract_version)) between 1 and 120),
  state text not null default 'PENDING'
    check (state in ('PENDING', 'COMPLETED', 'FAILED', 'OUTCOME_UNCERTAIN')),
  result_reference jsonb,
  failure jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (build_id, owner_user_id)
    references public.velto_creator_script_builds(id, owner_user_id) on delete cascade,
  check (
    (state = 'COMPLETED' and result_reference is not null and failure is null)
    or (state in ('FAILED', 'OUTCOME_UNCERTAIN') and result_reference is null and jsonb_typeof(failure) = 'object')
    or (state = 'PENDING' and result_reference is null and failure is null)
  )
);

create index velto_creator_script_build_operations_build_idx
  on public.velto_creator_script_build_operations(build_id, created_at);
create index velto_creator_script_build_operations_owner_idx
  on public.velto_creator_script_build_operations(owner_user_id, updated_at desc);

alter table public.velto_creator_script_builds enable row level security;
alter table public.velto_creator_script_build_operations enable row level security;

create policy "Users can read own creator script builds"
  on public.velto_creator_script_builds for select to authenticated
  using ((select auth.uid()) = owner_user_id);
create policy "Users can read own creator script build operations"
  on public.velto_creator_script_build_operations for select to authenticated
  using ((select auth.uid()) = owner_user_id);

revoke all on table public.velto_creator_script_builds from public, anon, authenticated;
revoke all on table public.velto_creator_script_build_operations from public, anon, authenticated;
grant select on table public.velto_creator_script_builds to authenticated;
grant select on table public.velto_creator_script_build_operations to authenticated;
grant all on table public.velto_creator_script_builds to service_role;
grant all on table public.velto_creator_script_build_operations to service_role;

create function public.velto_validate_creator_script_build_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project_owner uuid;
  v_transition_allowed boolean := false;
begin
  select owner_user_id into v_project_owner
  from public.velto_projects
  where id = new.project_id;
  if not found or v_project_owner is distinct from new.owner_user_id then
    raise exception 'CREATOR_SCRIPT_BUILD_PROJECT_NOT_OWNED';
  end if;

  if tg_op = 'INSERT' then
    if new.state is distinct from 'REQUESTED' then
      raise exception 'CREATOR_SCRIPT_BUILD_INITIAL_STATE_INVALID';
    end if;
    return new;
  end if;

  if row(
    new.id, new.owner_user_id, new.project_id, new.idempotency_key,
    new.expected_project_revision,
    new.strategy_fingerprint, new.language, new.requested_duration_seconds,
    new.snapshot_version, new.contract_versions, new.snapshot, new.created_at
  ) is distinct from row(
    old.id, old.owner_user_id, old.project_id, old.idempotency_key,
    old.expected_project_revision,
    old.strategy_fingerprint, old.language, old.requested_duration_seconds,
    old.snapshot_version, old.contract_versions, old.snapshot, old.created_at
  ) then
    raise exception 'CREATOR_SCRIPT_BUILD_SNAPSHOT_IMMUTABLE';
  end if;

  if new.state is distinct from old.state then
    v_transition_allowed := case old.state
      when 'REQUESTED' then new.state in ('SNAPSHOTTED', 'FAILED', 'STALE')
      when 'SNAPSHOTTED' then new.state in ('RESEARCH_READY', 'FAILED', 'STALE')
      when 'RESEARCH_READY' then new.state in ('EDITORIAL_COMPILED', 'FAILED', 'STALE')
      when 'EDITORIAL_COMPILED' then new.state in ('AUTHORITY_RESOLVED', 'FAILED', 'STALE')
      when 'AUTHORITY_RESOLVED' then new.state in ('SCRIPT_GENERATED', 'FAILED', 'STALE')
      when 'SCRIPT_GENERATED' then new.state in ('REPAIRING', 'ACCEPTED', 'FAILED', 'STALE')
      when 'REPAIRING' then new.state in ('ACCEPTED', 'FAILED', 'STALE')
      when 'ACCEPTED' then new.state in ('PERSISTED', 'FAILED', 'STALE')
      else false
    end;
    if not v_transition_allowed then
      raise exception 'CREATOR_SCRIPT_BUILD_TRANSITION_INVALID:%:%', old.state, new.state;
    end if;
  elsif old.state in ('PERSISTED', 'FAILED', 'STALE')
      and row(new.checkpoints, new.failure, new.result_authority)
          is distinct from row(old.checkpoints, old.failure, old.result_authority) then
    raise exception 'CREATOR_SCRIPT_BUILD_TERMINAL_IMMUTABLE';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger velto_creator_script_build_mutation_guard
  before insert or update on public.velto_creator_script_builds
  for each row execute function public.velto_validate_creator_script_build_mutation();

create function public.velto_validate_creator_script_build_operation_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_transition_allowed boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.state is distinct from 'PENDING' then
      raise exception 'CREATOR_SCRIPT_BUILD_OPERATION_INITIAL_STATE_INVALID';
    end if;
    return new;
  end if;
  if row(
    new.id, new.operation_identity, new.build_id, new.owner_user_id,
    new.stage, new.operation_type, new.semantic_fingerprint,
    new.contract_version, new.created_at
  ) is distinct from row(
    old.id, old.operation_identity, old.build_id, old.owner_user_id,
    old.stage, old.operation_type, old.semantic_fingerprint,
    old.contract_version, old.created_at
  ) then
    raise exception 'CREATOR_SCRIPT_BUILD_OPERATION_IDENTITY_IMMUTABLE';
  end if;
  if new.state is distinct from old.state then
    v_transition_allowed := case old.state
      when 'PENDING' then new.state in ('COMPLETED', 'FAILED', 'OUTCOME_UNCERTAIN')
      when 'OUTCOME_UNCERTAIN' then new.state in ('COMPLETED', 'FAILED')
      else false
    end;
    if not v_transition_allowed then
      raise exception 'CREATOR_SCRIPT_BUILD_OPERATION_TRANSITION_INVALID:%:%', old.state, new.state;
    end if;
  elsif old.state in ('COMPLETED', 'FAILED')
      and row(new.result_reference, new.failure)
          is distinct from row(old.result_reference, old.failure) then
    raise exception 'CREATOR_SCRIPT_BUILD_OPERATION_TERMINAL_IMMUTABLE';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger velto_creator_script_build_operation_mutation_guard
  before insert or update on public.velto_creator_script_build_operations
  for each row execute function public.velto_validate_creator_script_build_operation_mutation();

create function public.velto_creator_script_build_request(
  p_owner_user_id uuid,
  p_project_id uuid,
  p_idempotency_key text,
  p_expected_project_revision timestamptz,
  p_strategy_fingerprint text,
  p_language text,
  p_requested_duration_seconds integer,
  p_snapshot_version text,
  p_contract_versions jsonb,
  p_snapshot jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_build public.velto_creator_script_builds;
  v_project public.velto_projects%rowtype;
begin
  select * into v_build
  from public.velto_creator_script_builds
  where owner_user_id = p_owner_user_id and idempotency_key = p_idempotency_key;
  if found then
    if v_build.project_id is distinct from p_project_id
        or v_build.expected_project_revision is distinct from p_expected_project_revision
        or v_build.strategy_fingerprint is distinct from p_strategy_fingerprint
        or v_build.language is distinct from p_language
        or v_build.requested_duration_seconds is distinct from p_requested_duration_seconds
        or v_build.snapshot_version is distinct from p_snapshot_version
        or v_build.contract_versions is distinct from p_contract_versions
        or v_build.snapshot is distinct from p_snapshot then
      raise exception 'CREATOR_SCRIPT_BUILD_IDEMPOTENCY_COLLISION';
    end if;
    return jsonb_build_object('created', false, 'record', to_jsonb(v_build));
  end if;

  select * into v_project
  from public.velto_projects
  where id = p_project_id and owner_user_id = p_owner_user_id
  for update;
  if not found then raise exception 'CREATOR_SCRIPT_BUILD_PROJECT_NOT_OWNED'; end if;
  if v_project.flow_type is distinct from 'creator_lab' then
    raise exception 'CREATOR_SCRIPT_BUILD_PROJECT_FLOW_INVALID';
  end if;
  if v_project.updated_at is distinct from p_expected_project_revision then
    raise exception 'CREATOR_SCRIPT_BUILD_PROJECT_STALE';
  end if;

  begin
    insert into public.velto_creator_script_builds(
      owner_user_id, project_id, idempotency_key,
      expected_project_revision, strategy_fingerprint, language,
      requested_duration_seconds, snapshot_version, contract_versions, snapshot
    ) values (
      p_owner_user_id, p_project_id, p_idempotency_key,
      p_expected_project_revision, p_strategy_fingerprint, p_language,
      p_requested_duration_seconds, p_snapshot_version,
      p_contract_versions, p_snapshot
    ) returning * into v_build;
    return jsonb_build_object('created', true, 'record', to_jsonb(v_build));
  exception when unique_violation then
    select * into v_build
    from public.velto_creator_script_builds
    where owner_user_id = p_owner_user_id and idempotency_key = p_idempotency_key;
    if not found then raise; end if;
    if v_build.project_id is distinct from p_project_id
        or v_build.expected_project_revision is distinct from p_expected_project_revision
        or v_build.strategy_fingerprint is distinct from p_strategy_fingerprint
        or v_build.language is distinct from p_language
        or v_build.requested_duration_seconds is distinct from p_requested_duration_seconds
        or v_build.snapshot_version is distinct from p_snapshot_version
        or v_build.contract_versions is distinct from p_contract_versions
        or v_build.snapshot is distinct from p_snapshot then
      raise exception 'CREATOR_SCRIPT_BUILD_IDEMPOTENCY_COLLISION';
    end if;
    return jsonb_build_object('created', false, 'record', to_jsonb(v_build));
  end;
end;
$$;

create function public.velto_creator_script_build_checkpoint(
  p_owner_user_id uuid,
  p_build_id uuid,
  p_expected_build_state text,
  p_stage text,
  p_checkpoint jsonb
) returns public.velto_creator_script_builds
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_build public.velto_creator_script_builds;
  v_existing jsonb;
  v_existing_status text;
  v_next_status text;
  v_allowed boolean := false;
begin
  if p_stage not in ('research', 'editorial', 'authority', 'script_generation', 'repair', 'acceptance', 'persistence')
      or jsonb_typeof(p_checkpoint) is distinct from 'object'
      or p_checkpoint->>'stage' is distinct from p_stage
      or coalesce(p_checkpoint->>'checkpointId', '') !~ '^creator-script-build-checkpoint-v1:[0-9a-f]{64}$'
      or length(trim(coalesce(p_checkpoint->>'contractVersion', ''))) not between 1 and 120
      or jsonb_typeof(coalesce(p_checkpoint->'diagnostics', '{}'::jsonb)) is distinct from 'object' then
    raise exception 'CREATOR_SCRIPT_BUILD_CHECKPOINT_INVALID';
  end if;
  select * into v_build from public.velto_creator_script_builds
  where id = p_build_id and owner_user_id = p_owner_user_id for update;
  if not found then raise exception 'CREATOR_SCRIPT_BUILD_NOT_OWNED'; end if;
  if v_build.state is distinct from p_expected_build_state
      or v_build.state in ('PERSISTED', 'FAILED', 'STALE') then
    raise exception 'CREATOR_SCRIPT_BUILD_CHECKPOINT_STALE';
  end if;
  v_existing := v_build.checkpoints->p_stage;
  v_next_status := p_checkpoint->>'status';
  if v_next_status not in ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED') then
    raise exception 'CREATOR_SCRIPT_BUILD_CHECKPOINT_STATUS_INVALID';
  end if;
  if v_existing is null then
    v_allowed := v_next_status in ('PENDING', 'RUNNING');
  else
    v_existing_status := v_existing->>'status';
    if v_existing = p_checkpoint then return v_build; end if;
    v_allowed := (v_existing_status = 'PENDING' and v_next_status in ('RUNNING', 'COMPLETED', 'FAILED'))
      or (v_existing_status = 'RUNNING' and v_next_status in ('COMPLETED', 'FAILED'));
  end if;
  if not v_allowed then raise exception 'CREATOR_SCRIPT_BUILD_CHECKPOINT_TRANSITION_INVALID'; end if;
  update public.velto_creator_script_builds
  set checkpoints = jsonb_set(checkpoints, array[p_stage], p_checkpoint, true)
  where id = p_build_id and owner_user_id = p_owner_user_id
  returning * into v_build;
  return v_build;
end;
$$;

create function public.velto_creator_script_build_operation_request(
  p_owner_user_id uuid,
  p_build_id uuid,
  p_operation_identity text,
  p_stage text,
  p_operation_type text,
  p_semantic_fingerprint text,
  p_contract_version text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_build public.velto_creator_script_builds;
  v_operation public.velto_creator_script_build_operations;
begin
  select * into v_operation from public.velto_creator_script_build_operations
  where operation_identity = p_operation_identity and owner_user_id = p_owner_user_id;
  if found then
    if v_operation.build_id is distinct from p_build_id
        or v_operation.stage is distinct from p_stage
        or v_operation.operation_type is distinct from p_operation_type
        or v_operation.semantic_fingerprint is distinct from p_semantic_fingerprint
        or v_operation.contract_version is distinct from p_contract_version then
      raise exception 'CREATOR_SCRIPT_BUILD_OPERATION_IDENTITY_COLLISION';
    end if;
    return jsonb_build_object('created', false, 'record', to_jsonb(v_operation));
  end if;

  select * into v_build from public.velto_creator_script_builds
  where id = p_build_id and owner_user_id = p_owner_user_id;
  if not found then raise exception 'CREATOR_SCRIPT_BUILD_NOT_OWNED'; end if;
  if v_build.state in ('PERSISTED', 'FAILED', 'STALE') then
    raise exception 'CREATOR_SCRIPT_BUILD_OPERATION_TERMINAL';
  end if;
  begin
    insert into public.velto_creator_script_build_operations(
      operation_identity, build_id, owner_user_id, stage, operation_type,
      semantic_fingerprint, contract_version
    ) values (
      p_operation_identity, p_build_id, p_owner_user_id, p_stage,
      p_operation_type, p_semantic_fingerprint, p_contract_version
    ) returning * into v_operation;
    return jsonb_build_object('created', true, 'record', to_jsonb(v_operation));
  exception when unique_violation then
    select * into v_operation from public.velto_creator_script_build_operations
    where operation_identity = p_operation_identity and owner_user_id = p_owner_user_id;
    if not found then raise; end if;
    if v_operation.build_id is distinct from p_build_id
        or v_operation.stage is distinct from p_stage
        or v_operation.operation_type is distinct from p_operation_type
        or v_operation.semantic_fingerprint is distinct from p_semantic_fingerprint
        or v_operation.contract_version is distinct from p_contract_version then
      raise exception 'CREATOR_SCRIPT_BUILD_OPERATION_IDENTITY_COLLISION';
    end if;
    return jsonb_build_object('created', false, 'record', to_jsonb(v_operation));
  end;
end;
$$;

revoke all on function public.velto_validate_creator_script_build_mutation() from public, anon, authenticated;
revoke all on function public.velto_validate_creator_script_build_operation_mutation() from public, anon, authenticated;
revoke all on function public.velto_creator_script_build_request(uuid, uuid, text, timestamptz, text, text, integer, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.velto_creator_script_build_checkpoint(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.velto_creator_script_build_operation_request(uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated;

grant execute on function public.velto_creator_script_build_request(uuid, uuid, text, timestamptz, text, text, integer, text, jsonb, jsonb)
  to service_role;
grant execute on function public.velto_creator_script_build_checkpoint(uuid, uuid, text, text, jsonb)
  to service_role;
grant execute on function public.velto_creator_script_build_operation_request(uuid, uuid, text, text, text, text, text)
  to service_role;

commit;
