-- Stage 0.10F: additive query support; immutable ledgers remain source of truth.
create index if not exists velto_creator_econ_user_created_idx
  on public.velto_creator_economic_operations(user_id, created_at desc);
