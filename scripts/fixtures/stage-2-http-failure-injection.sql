create table if not exists public.stage2_http_failure_injection (
  boundary text primary key check (boundary in ('credit','economic','admission','enqueue'))
);
alter table public.stage2_http_failure_injection enable row level security;
revoke all on public.stage2_http_failure_injection from public,anon,authenticated;
grant all on public.stage2_http_failure_injection to service_role;

create or replace function public.stage2_http_hold_economic_boundary(p_seconds double precision default 2)
returns void language plpgsql security invoker set search_path='' as $$
begin
  lock table public.velto_creator_economic_operations in access exclusive mode;
  perform pg_catalog.pg_sleep(greatest(0.1,least(coalesce(p_seconds,2),5)));
end $$;
revoke all on function public.stage2_http_hold_economic_boundary(double precision) from public,anon,authenticated;
grant execute on function public.stage2_http_hold_economic_boundary(double precision) to service_role;

create or replace function public.stage2_http_inject_failure() returns trigger
language plpgsql set search_path='' as $$
declare v_boundary text := tg_argv[0];
begin
  if exists(select 1 from public.stage2_http_failure_injection where boundary=v_boundary) then
    raise exception 'STAGE2_HTTP_INJECTED_%', upper(v_boundary);
  end if;
  return new;
end $$;

drop trigger if exists stage2_http_fail_credit on public.velto_credit_reservations;
create trigger stage2_http_fail_credit before insert on public.velto_credit_reservations
for each row execute function public.stage2_http_inject_failure('credit');
drop trigger if exists stage2_http_fail_economic on public.velto_creator_economic_operations;
create trigger stage2_http_fail_economic before insert on public.velto_creator_economic_operations
for each row execute function public.stage2_http_inject_failure('economic');
drop trigger if exists stage2_http_fail_admission on public.velto_storage_admissions;
create trigger stage2_http_fail_admission before insert on public.velto_storage_admissions
for each row execute function public.stage2_http_inject_failure('admission');
drop trigger if exists stage2_http_fail_enqueue on public.velto_jobs;
create trigger stage2_http_fail_enqueue before insert on public.velto_jobs
for each row when (new.job_type='creator_final_export') execute function public.stage2_http_inject_failure('enqueue');
