begin;

create extension if not exists pgcrypto;

create table if not exists public.velto_credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_credits bigint not null default 0 check (balance_credits >= 0),
  reserved_credits bigint not null default 0 check (reserved_credits >= 0),
  lifetime_granted_credits bigint not null default 0 check (lifetime_granted_credits >= 0),
  lifetime_used_credits bigint not null default 0 check (lifetime_used_credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reserved_credits <= balance_credits)
);

create table if not exists public.velto_credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_type text not null,
  provider text,
  reference_id text,
  reserved_credits bigint not null check (reserved_credits > 0),
  settled_credits bigint not null default 0 check (settled_credits >= 0),
  status text not null default 'reserved'
    check (status in ('reserved', 'settled', 'released', 'expired')),
  idempotency_key text not null,
  provider_cost_usd numeric(18, 8),
  provider_request_id text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists velto_credit_reservations_user_status_idx
  on public.velto_credit_reservations(user_id, status, created_at desc);

create table if not exists public.velto_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reservation_id uuid references public.velto_credit_reservations(id) on delete set null,
  entry_type text not null
    check (entry_type in ('grant', 'purchase', 'reserve', 'settle', 'release', 'expire', 'adjustment', 'refund')),
  balance_delta bigint not null default 0,
  reserved_delta bigint not null default 0,
  balance_after bigint not null check (balance_after >= 0),
  reserved_after bigint not null check (reserved_after >= 0),
  operation_type text,
  provider text,
  reference_id text,
  idempotency_key text,
  provider_cost_usd numeric(18, 8),
  provider_request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists velto_credit_ledger_idempotency_idx
  on public.velto_credit_ledger(user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists velto_credit_ledger_user_created_idx
  on public.velto_credit_ledger(user_id, created_at desc);

alter table public.velto_credit_accounts enable row level security;
alter table public.velto_credit_reservations enable row level security;
alter table public.velto_credit_ledger enable row level security;

drop policy if exists "Users can read own credit account" on public.velto_credit_accounts;
create policy "Users can read own credit account"
  on public.velto_credit_accounts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read own credit reservations" on public.velto_credit_reservations;
create policy "Users can read own credit reservations"
  on public.velto_credit_reservations for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read own credit ledger" on public.velto_credit_ledger;
create policy "Users can read own credit ledger"
  on public.velto_credit_ledger for select
  using (auth.uid() = user_id);

create or replace function public.velto_credit_account_json(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'user_id', a.user_id,
    'balance_credits', a.balance_credits,
    'reserved_credits', a.reserved_credits,
    'available_credits', a.balance_credits - a.reserved_credits,
    'lifetime_granted_credits', a.lifetime_granted_credits,
    'lifetime_used_credits', a.lifetime_used_credits,
    'updated_at', a.updated_at
  )
  from public.velto_credit_accounts a
  where a.user_id = p_user_id;
$$;

create or replace function public.velto_credit_reservation_json(p_reservation_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(r)
  from public.velto_credit_reservations r
  where r.id = p_reservation_id;
$$;

create or replace function public.velto_credit_get_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.velto_credit_accounts(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  return public.velto_credit_account_json(p_user_id);
end;
$$;

create or replace function public.velto_credit_reserve(
  p_user_id uuid,
  p_credits bigint,
  p_operation_type text,
  p_idempotency_key text,
  p_provider text default null,
  p_reference_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.velto_credit_accounts%rowtype;
  v_existing public.velto_credit_reservations%rowtype;
  v_reservation public.velto_credit_reservations%rowtype;
begin
  if p_credits is null or p_credits <= 0 then
    raise exception 'INVALID_CREDIT_AMOUNT';
  end if;

  insert into public.velto_credit_accounts(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_existing
  from public.velto_credit_reservations
  where user_id = p_user_id and idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'account', public.velto_credit_account_json(p_user_id),
      'reservation', public.velto_credit_reservation_json(v_existing.id)
    );
  end if;

  select * into v_account
  from public.velto_credit_accounts
  where user_id = p_user_id
  for update;

  if (v_account.balance_credits - v_account.reserved_credits) < p_credits then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  insert into public.velto_credit_reservations(
    user_id,
    operation_type,
    provider,
    reference_id,
    reserved_credits,
    idempotency_key,
    metadata,
    expires_at
  ) values (
    p_user_id,
    p_operation_type,
    p_provider,
    p_reference_id,
    p_credits,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_expires_at, now() + interval '30 minutes')
  ) returning * into v_reservation;

  update public.velto_credit_accounts
  set reserved_credits = reserved_credits + p_credits,
      updated_at = now()
  where user_id = p_user_id
  returning * into v_account;

  insert into public.velto_credit_ledger(
    user_id,
    reservation_id,
    entry_type,
    balance_delta,
    reserved_delta,
    balance_after,
    reserved_after,
    operation_type,
    provider,
    reference_id,
    idempotency_key,
    metadata
  ) values (
    p_user_id,
    v_reservation.id,
    'reserve',
    0,
    p_credits,
    v_account.balance_credits,
    v_account.reserved_credits,
    p_operation_type,
    p_provider,
    p_reference_id,
    'reserve:' || p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return jsonb_build_object(
    'account', public.velto_credit_account_json(p_user_id),
    'reservation', public.velto_credit_reservation_json(v_reservation.id)
  );
end;
$$;

create or replace function public.velto_credit_settle(
  p_user_id uuid,
  p_reservation_id uuid,
  p_final_credits bigint,
  p_provider_cost_usd numeric default null,
  p_provider_request_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.velto_credit_accounts%rowtype;
  v_reservation public.velto_credit_reservations%rowtype;
  v_extra bigint;
begin
  if p_final_credits is null or p_final_credits <= 0 then
    raise exception 'INVALID_CREDIT_AMOUNT';
  end if;

  select * into v_reservation
  from public.velto_credit_reservations
  where id = p_reservation_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;

  if v_reservation.status = 'settled' then
    return jsonb_build_object(
      'account', public.velto_credit_account_json(p_user_id),
      'reservation', public.velto_credit_reservation_json(v_reservation.id)
    );
  end if;

  if v_reservation.status <> 'reserved' then
    raise exception 'INVALID_RESERVATION_STATE';
  end if;

  select * into v_account
  from public.velto_credit_accounts
  where user_id = p_user_id
  for update;

  v_extra := greatest(0, p_final_credits - v_reservation.reserved_credits);

  if (v_account.balance_credits - v_account.reserved_credits) < v_extra then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  update public.velto_credit_accounts
  set balance_credits = balance_credits - p_final_credits,
      reserved_credits = reserved_credits - v_reservation.reserved_credits,
      lifetime_used_credits = lifetime_used_credits + p_final_credits,
      updated_at = now()
  where user_id = p_user_id
  returning * into v_account;

  update public.velto_credit_reservations
  set settled_credits = p_final_credits,
      status = 'settled',
      provider_cost_usd = p_provider_cost_usd,
      provider_request_id = p_provider_request_id,
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
      updated_at = now()
  where id = p_reservation_id
  returning * into v_reservation;

  insert into public.velto_credit_ledger(
    user_id,
    reservation_id,
    entry_type,
    balance_delta,
    reserved_delta,
    balance_after,
    reserved_after,
    operation_type,
    provider,
    reference_id,
    idempotency_key,
    provider_cost_usd,
    provider_request_id,
    metadata
  ) values (
    p_user_id,
    v_reservation.id,
    'settle',
    -p_final_credits,
    -v_reservation.reserved_credits,
    v_account.balance_credits,
    v_account.reserved_credits,
    v_reservation.operation_type,
    v_reservation.provider,
    v_reservation.reference_id,
    'settle:' || v_reservation.id::text,
    p_provider_cost_usd,
    p_provider_request_id,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return jsonb_build_object(
    'account', public.velto_credit_account_json(p_user_id),
    'reservation', public.velto_credit_reservation_json(v_reservation.id)
  );
end;
$$;

create or replace function public.velto_credit_release(
  p_user_id uuid,
  p_reservation_id uuid,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.velto_credit_accounts%rowtype;
  v_reservation public.velto_credit_reservations%rowtype;
begin
  select * into v_reservation
  from public.velto_credit_reservations
  where id = p_reservation_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;

  if v_reservation.status = 'released' then
    return jsonb_build_object(
      'account', public.velto_credit_account_json(p_user_id),
      'reservation', public.velto_credit_reservation_json(v_reservation.id)
    );
  end if;

  if v_reservation.status <> 'reserved' then
    raise exception 'INVALID_RESERVATION_STATE';
  end if;

  update public.velto_credit_accounts
  set reserved_credits = reserved_credits - v_reservation.reserved_credits,
      updated_at = now()
  where user_id = p_user_id
  returning * into v_account;

  update public.velto_credit_reservations
  set status = 'released',
      metadata = metadata || jsonb_build_object('release_reason', p_reason) || coalesce(p_metadata, '{}'::jsonb),
      updated_at = now()
  where id = p_reservation_id
  returning * into v_reservation;

  insert into public.velto_credit_ledger(
    user_id,
    reservation_id,
    entry_type,
    balance_delta,
    reserved_delta,
    balance_after,
    reserved_after,
    operation_type,
    provider,
    reference_id,
    idempotency_key,
    metadata
  ) values (
    p_user_id,
    v_reservation.id,
    'release',
    0,
    -v_reservation.reserved_credits,
    v_account.balance_credits,
    v_account.reserved_credits,
    v_reservation.operation_type,
    v_reservation.provider,
    v_reservation.reference_id,
    'release:' || v_reservation.id::text,
    jsonb_build_object('release_reason', p_reason) || coalesce(p_metadata, '{}'::jsonb)
  );

  return jsonb_build_object(
    'account', public.velto_credit_account_json(p_user_id),
    'reservation', public.velto_credit_reservation_json(v_reservation.id)
  );
end;
$$;

create or replace function public.velto_credit_grant(
  p_user_id uuid,
  p_credits bigint,
  p_reference_id text,
  p_entry_type text default 'grant',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.velto_credit_accounts%rowtype;
begin
  if p_credits is null or p_credits <= 0 then
    raise exception 'INVALID_CREDIT_AMOUNT';
  end if;

  if p_entry_type not in ('grant', 'purchase', 'adjustment', 'refund') then
    raise exception 'INVALID_LEDGER_ENTRY_TYPE';
  end if;

  insert into public.velto_credit_accounts(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.velto_credit_accounts
  set balance_credits = balance_credits + p_credits,
      lifetime_granted_credits = lifetime_granted_credits + p_credits,
      updated_at = now()
  where user_id = p_user_id
  returning * into v_account;

  insert into public.velto_credit_ledger(
    user_id,
    entry_type,
    balance_delta,
    reserved_delta,
    balance_after,
    reserved_after,
    reference_id,
    idempotency_key,
    metadata
  ) values (
    p_user_id,
    p_entry_type,
    p_credits,
    0,
    v_account.balance_credits,
    v_account.reserved_credits,
    p_reference_id,
    p_entry_type || ':' || p_reference_id,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return public.velto_credit_account_json(p_user_id);
end;
$$;

create or replace function public.velto_create_credit_account_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.velto_credit_accounts(user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists velto_auth_user_credit_account on auth.users;
create trigger velto_auth_user_credit_account
after insert on auth.users
for each row execute procedure public.velto_create_credit_account_for_new_user();

insert into public.velto_credit_accounts(user_id)
select id from auth.users
on conflict (user_id) do nothing;

revoke all on function public.velto_credit_account_json(uuid) from public, anon, authenticated;
revoke all on function public.velto_credit_reservation_json(uuid) from public, anon, authenticated;
revoke all on function public.velto_credit_get_account(uuid) from public, anon, authenticated;
revoke all on function public.velto_credit_reserve(uuid, bigint, text, text, text, text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.velto_credit_settle(uuid, uuid, bigint, numeric, text, jsonb) from public, anon, authenticated;
revoke all on function public.velto_credit_release(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.velto_credit_grant(uuid, bigint, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.velto_create_credit_account_for_new_user() from public, anon, authenticated;

grant execute on function public.velto_credit_account_json(uuid) to service_role;
grant execute on function public.velto_credit_reservation_json(uuid) to service_role;
grant execute on function public.velto_credit_get_account(uuid) to service_role;
grant execute on function public.velto_credit_reserve(uuid, bigint, text, text, text, text, jsonb, timestamptz) to service_role;
grant execute on function public.velto_credit_settle(uuid, uuid, bigint, numeric, text, jsonb) to service_role;
grant execute on function public.velto_credit_release(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.velto_credit_grant(uuid, bigint, text, text, jsonb) to service_role;

commit;
