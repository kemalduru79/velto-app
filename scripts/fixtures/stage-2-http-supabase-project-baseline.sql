create table public.velto_projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  child_id text,
  title text not null default '',
  input_prompt text,
  language text,
  characters jsonb not null default '[]'::jsonb,
  scenes jsonb not null default '[]'::jsonb,
  creator_mentor_result jsonb,
  creator_production_package jsonb,
  refined_creator_scenes jsonb,
  exported_movie_url text,
  exported_movie_result jsonb,
  export_signature text,
  flow_type text not null default 'storyverse',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.velto_projects enable row level security;
create policy "owners read projects" on public.velto_projects for select to authenticated using ((select auth.uid())=owner_user_id);
revoke all on public.velto_projects from public,anon,authenticated;
grant select on public.velto_projects to authenticated;
grant all on public.velto_projects to service_role;
