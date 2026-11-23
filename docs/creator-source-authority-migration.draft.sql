-- DESIGN DRAFT ONLY: not a migration and not applied. Review with a local
-- Supabase database and security tests before generating a real migration.
-- Only the server's service role may read or write verification records.
create table public.creator_source_authority_snapshots (
  owner_user_id uuid not null references auth.users(id),
  project_id text not null,
  snapshot_digest text not null check (snapshot_digest ~ '^[0-9a-f]{64}$'),
  editorial_context jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner_user_id, project_id, snapshot_digest)
);
alter table public.creator_source_authority_snapshots enable row level security;
revoke all on public.creator_source_authority_snapshots from public, anon, authenticated;
grant select, insert on public.creator_source_authority_snapshots to service_role;

create table public.creator_source_authority_verifications (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  project_id text not null,
  snapshot_digest text not null check (snapshot_digest ~ '^[0-9a-f]{64}$'),
  source_id text not null,
  claim_id text not null,
  evidence_id text not null,
  source_digest text not null check (source_digest ~ '^[0-9a-f]{64}$'),
  passage_digest text not null check (passage_digest ~ '^[0-9a-f]{64}$'),
  passage_verification text not null check (passage_verification = 'exact_source_match'),
  authority_classification text not null check (authority_classification in ('original_research', 'primary_document', 'secondary', 'unknown')),
  document_digest text not null check (document_digest ~ '^[0-9a-f]{64}$'),
  qualification_method text not null,
  claim_evidence_disposition text not null default 'insufficient_or_ambiguous_support' check (claim_evidence_disposition in ('documented_methodological_limitation', 'independent_editorial_inference', 'insufficient_or_ambiguous_support')),
  disposition_rationale text not null default '',
  check (claim_evidence_disposition = 'insufficient_or_ambiguous_support' or length(trim(disposition_rationale)) >= 12),
  reviewer_user_id uuid not null references auth.users(id),
  reviewer_authorization text not null,
  review_basis text not null,
  publisher_authorship_confirmed boolean not null,
  qualified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > qualified_at),
  check (authority_classification not in ('original_research', 'primary_document') or publisher_authorship_confirmed),
  foreign key (owner_user_id, project_id, snapshot_digest) references public.creator_source_authority_snapshots (owner_user_id, project_id, snapshot_digest),
  unique (owner_user_id, project_id, snapshot_digest, claim_id, evidence_id)
);
alter table public.creator_source_authority_verifications enable row level security;
revoke all on public.creator_source_authority_verifications from public, anon, authenticated;
grant select, insert, update, delete on public.creator_source_authority_verifications to service_role;
-- Revoke default service-role privileges as well; the application uses only
-- append-only inserts and reads for these records.
revoke update, delete, truncate on public.creator_source_authority_snapshots from service_role;
revoke update, delete, truncate on public.creator_source_authority_verifications from service_role;
