insert into auth.users(id) values ('22222222-2222-4222-8222-222222222222');
select public.velto_credit_grant('22222222-2222-4222-8222-222222222222',10,'stage2c-concurrent','grant','{}');
insert into public.velto_projects(id,owner_user_id,flow_type,updated_at)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','22222222-2222-4222-8222-222222222222','creator_lab','2026-10-16 14:00:00+00');
