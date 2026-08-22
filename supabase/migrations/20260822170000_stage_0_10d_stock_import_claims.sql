begin;

alter table public.velto_stock_imports alter column asset_id drop not null;
alter table public.velto_stock_imports alter column public_url drop not null;
alter table public.velto_stock_imports add column if not exists status text not null default 'ready'
  check (status in ('pending', 'ready'));
alter table public.velto_stock_imports add constraint velto_stock_import_ready_fields_check check (
  (status = 'pending' and asset_id is null and public_url is null) or
  (status = 'ready' and asset_id is not null and public_url is not null)
);
create index if not exists velto_stock_imports_pending_created_idx
  on public.velto_stock_imports(created_at) where status = 'pending';

commit;
