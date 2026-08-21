# Stage 0.9 Data Lifecycle Baseline

This document records current repository behavior. It does not create deletion guarantees or certify legal compliance.

## Account / identity

Supabase Auth is the current identity authority. Account-wide deletion is not implemented in 0.9A, and no assumption is made about `auth.users` cascade behavior across Velto data. A safe erasure design requires the Stage 0.9B inventory and decisions documented in the status contract.

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

New signup requests include versioned Terms and Privacy acceptance metadata with a shared ISO timestamp and selected `tr` or `en` policy locale. Supabase `user_metadata` is a product baseline, not an authoritative immutable consent ledger. Whether to add an immutable consent-event table or backfill existing users is deferred pending demonstrated product/legal need.

## Providers

Generation requests may send the user or project content required for the requested operation to configured AI or media providers. Provider-specific retention and legal terms are outside guarantees made by this repository. 0.9A makes no provider calls or routing changes.

## Deferred high-risk lifecycle work

Account-wide erasure requires a complete durable-data, relationship, Storage, queue, credit, entitlement, share, retention, confirmation, and recovery design. Storyverse child/guardian consent requires product/legal decisions on identity, age bands, evidence, revocation, and migration. Both remain Stage 0.9B items; neither is silently approximated here.
