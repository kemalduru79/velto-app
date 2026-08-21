# Stage 0.9 — Security, Consent, Legal & Data Lifecycle

## Current

- 0.9A Broad Security / Consent / Legal / Lifecycle Baseline: **IN PROGRESS**
- 0.9B High-Risk Identity & Data Lifecycle: **DEFERRED / ONLY IF REQUIRED**
- 0.9C Closure: **NOT STARTED**

## 0.9A scope

0.9A may include the policy/version contract, public Terms and Privacy surfaces, signup consent clarity and version metadata, conservative security headers, public-sharing revoke capability, lifecycle documentation, and deterministic offline regression.

0.9A must not include account-wide destructive deletion, `auth.users` deletion, unknown cascade assumptions, bulk existing-user mutation, consent backfill, child/guardian identity migration, age-verification architecture, production database mutation, paid provider calls, or Azure work.

Existing Stage 0.7 media Trash / Restore / Purge lifecycle remains authoritative and is not redesigned in Stage 0.9A. Trash remains recoverable and consumes storage until a separately controlled permanent purge succeeds.

## Baseline decisions

- Terms and Privacy use centralized deterministic versions and conservative TR/EN product copy. Public legal copy requires legal review before external commercial launch.
- A single signup acceptance action records matching Terms and Privacy timestamps, policy versions, and locale in Supabase `user_metadata`. User metadata is **not** treated as the final authoritative immutable legal consent ledger and is never used for authorization. A dedicated immutable consent-event ledger and any existing-user backfill decision are deferred to 0.9B if required.
- Global low-breakage headers include `nosniff`, strict-origin referrer handling, disabled unused camera/microphone/geolocation capabilities, and anti-framing. An enforced Content Security Policy is deferred because the repository uses Next.js runtime behavior, fonts, Supabase, data/blob media, external media, and Vercel paths that were not exhaustively proven under a strict CSP.
- Storyverse sharing can be revoked by an authenticated owner. The public lookup already requires `is_public=true`, so revocation immediately disables the URL. CreatorLab remains unsupported. Because the historical `velto_projects` schema migration is absent and `share_id` nullability cannot be proven, 0.9A does not clear `share_id`; a later republish may reuse the prior identifier.

## 0.9B high-risk deferred work

### Account-wide data erasure

Before implementation, enumerate every user-owned or durable table; verify foreign keys and `ON DELETE` behavior; inspect Storage objects, queues/jobs, credit and financial records, music entitlements and usage, and public shares; decide independently retained financial/security records; and define fail-closed orchestration, confirmation, and recovery. Partial migration history is not evidence of safe cascades, so account-wide deletion and `auth.users` deletion are excluded from 0.9A.

### Storyverse child / guardian consent

Before implementation, product and legal review must decide the account-holder model, age bands, any guardian relationship, consent evidence/version model, revocation, and migration/backfill strategy. 0.9A does not invent age verification, guardian consent, or child/guardian database schema.

## Explicit non-actions

No dependency, database migration, live data mutation, provider or credit call, deployment, Azure resource, provider routing, queue behavior, or Stage 0.7 media-lifecycle behavior is introduced.
