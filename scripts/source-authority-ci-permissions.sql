\set ON_ERROR_STOP on
-- The service role bypasses RLS in Supabase. Its cross-owner restrictions are
-- enforced by application checks, not by PostgreSQL policies in this draft.
do $$ begin
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('creator_source_authority_snapshots','creator_source_authority_verifications') and c.relrowsecurity) <> 2 then raise exception 'RLS_NOT_ENABLED'; end if;
end $$;
create function public.ci_expect_denied(statement text) returns void language plpgsql as $$
begin
  begin execute statement; exception when insufficient_privilege then return; end;
  raise exception 'UNEXPECTED_PERMISSION: %', statement;
end $$;
set role anon;
select public.ci_expect_denied('select * from public.creator_source_authority_snapshots');
select public.ci_expect_denied('insert into public.creator_source_authority_snapshots default values');
select public.ci_expect_denied('update public.creator_source_authority_snapshots set project_id = ''x''');
select public.ci_expect_denied('delete from public.creator_source_authority_snapshots');
select public.ci_expect_denied('select * from public.creator_source_authority_verifications');
select public.ci_expect_denied('insert into public.creator_source_authority_verifications default values');
select public.ci_expect_denied('update public.creator_source_authority_verifications set project_id = ''x''');
select public.ci_expect_denied('delete from public.creator_source_authority_verifications');
reset role;
set role authenticated;
select public.ci_expect_denied('select * from public.creator_source_authority_snapshots');
select public.ci_expect_denied('insert into public.creator_source_authority_snapshots default values');
select public.ci_expect_denied('update public.creator_source_authority_snapshots set project_id = ''x''');
select public.ci_expect_denied('delete from public.creator_source_authority_snapshots');
select public.ci_expect_denied('select * from public.creator_source_authority_verifications');
select public.ci_expect_denied('insert into public.creator_source_authority_verifications default values');
select public.ci_expect_denied('update public.creator_source_authority_verifications set project_id = ''x''');
select public.ci_expect_denied('delete from public.creator_source_authority_verifications');
reset role;
set role service_role;
select public.ci_expect_denied('update public.creator_source_authority_snapshots set project_id = ''x''');
select public.ci_expect_denied('delete from public.creator_source_authority_snapshots');
select public.ci_expect_denied('update public.creator_source_authority_verifications set project_id = ''x''');
select public.ci_expect_denied('delete from public.creator_source_authority_verifications');
reset role;
