-- Stage 0.10B: additive internal CreatorLab COGS operation ledger.
create table if not exists public.velto_creator_economic_operations (
  id uuid primary key default gen_random_uuid(),
  attempt_key text not null unique,
  logical_operation_id text not null,
  idempotency_key text,
  credit_reservation_id uuid references public.velto_credit_reservations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  project_id text,
  scene_id text,
  export_id text,
  route text not null,
  operation_type text not null,
  product_tier text,
  provider text,
  provider_tier text,
  model text,
  fallback_provider text,
  fallback_model text,
  provider_request_id text,
  state text not null check (state in ('reserved','dispatch_attempted','provider_accepted','provider_failed_before_acceptance','provider_billed','application_failed_after_provider_cost','settled','released','reconciled')),
  billing_moment text,
  ambiguity_reason text,
  generation_attempt integer not null default 1 check (generation_attempt > 0),
  fallback_attempt boolean not null default false,
  generated boolean not null default true,
  asset_identity text,
  reuse_identity text,
  quantities jsonb not null default '{}'::jsonb,
  estimated_provider_cost_usd numeric(18,10),
  actual_provider_cost_usd numeric(18,10),
  provider_cost_usd numeric(18,10),
  cost_status text not null check (cost_status in ('exact','estimated','unknown','not_billable')),
  currency text not null default 'USD' check (currency = 'USD'),
  pricing_version text,
  pricing_as_of date,
  cost_components jsonb not null default '{}'::jsonb,
  cost_reason text,
  dispatched_at timestamptz,
  provider_accepted_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists velto_creator_econ_user_project_idx on public.velto_creator_economic_operations(user_id, project_id, created_at desc);
create index if not exists velto_creator_econ_operation_idx on public.velto_creator_economic_operations(operation_type, created_at desc);
create index if not exists velto_creator_econ_provider_request_idx on public.velto_creator_economic_operations(provider, provider_request_id) where provider_request_id is not null;
create index if not exists velto_creator_econ_logical_idx on public.velto_creator_economic_operations(logical_operation_id, generation_attempt);
create index if not exists velto_creator_econ_idempotency_idx on public.velto_creator_economic_operations(idempotency_key) where idempotency_key is not null;
alter table public.velto_creator_economic_operations enable row level security;
revoke all on table public.velto_creator_economic_operations from public, anon, authenticated;
grant all on table public.velto_creator_economic_operations to service_role;
