# Stage 0.9 Data Lifecycle Baseline

This document records current repository behavior. It does not create deletion guarantees or certify legal compliance.

## Account / identity

Supabase Auth is the current identity authority. Automated account-wide deletion is not implemented in Stage 0. Mixed database deletion semantics and incomplete historical schema evidence prevent safe cascade assumptions. Account-wide erasure is therefore an external/public beta readiness blocker and requires verified production-schema, Storage, retention, confirmation, and recovery orchestration before implementation.

## Projects

Project persistence is owner-scoped. Storyverse public sharing is explicit, owner-only, and exposes the existing bounded public projection. An authenticated owner can revoke sharing; the public route then fails because it requires `is_public=true`. CreatorLab sharing remains unsupported. Since `share_id` nullability is not proven by repository schema history, revoke retains the identifier and a later republish may reuse the old URL.

## Media

The authoritative lifecycle remains:

`ACTIVE → TRASH → RESTORE`

Physical purge is separately controlled, reference-safe, retention-gated, recoverable on coordination failure, and feature-controlled. Trash is a recoverable logical state, still consumes storage, and does not mean the object was physically deleted. Stage 0.9A does not change the Stage 0.7 Trash / Restore / Purge implementation.

## Credits / financial ledger

Credit reservations, accounts, and ledger records are not personal-data deletion behavior. 0.9A does not change their semantics. Any independent record-retention or legal decision is deferred.

## Jobs / operational data

Durable queue, worker, reconciliation, health, and other operational records exist. Their retention and execution semantics are unchanged in 0.9A.

## Consent

New signup requests include versioned Terms and Privacy acceptance metadata with a shared ISO timestamp and selected `tr` or `en` policy locale. Supabase `user_metadata` is a product baseline, not an authoritative immutable consent ledger. Whether to add an immutable consent-event table or backfill existing users is deferred pending demonstrated product/legal need. For Stage 0, the product account model is an adult account holder aged 18+. Storyverse does not provide independent child accounts; the youth-oriented experience operates under an adult-managed account. Technical age verification and child/guardian persistence are not implemented, and external/public Storyverse release requires a separate legal/product gate.

## Providers

Generation requests may send the user or project content required for the requested operation to configured AI or media providers. Provider-specific retention and legal terms are outside guarantees made by this repository. 0.9A makes no provider calls or routing changes.

## Deferred high-risk lifecycle work

Account-wide erasure remains deferred until external/public beta readiness because it requires a complete durable-data, relationship, Storage, queue, credit, entitlement, share, retention, confirmation, and recovery design. Storyverse independent child accounts and guardian persistence are intentionally excluded from Stage 0; external/public Storyverse release requires legal/product review of age assurance, guardian consent, evidence, revocation, and jurisdiction-specific requirements.
