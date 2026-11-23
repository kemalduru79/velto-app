\set ON_ERROR_STOP on
-- Synthetic stand-ins, not a Supabase Auth or PostgREST installation.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
-- Minimal isolated stand-in for project CAS/ownership; not Supabase Auth.
create table public.velto_projects (id uuid primary key, owner_user_id uuid not null, flow_type text not null, exported_movie_result jsonb, updated_at timestamptz not null default now());
insert into public.velto_projects (id,owner_user_id,flow_type) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','creator_lab');
grant select, update on public.velto_projects to service_role;
