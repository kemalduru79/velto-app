# Supabase Migration Baseline

## Why this manifest exists

The linked live project was found with an empty/drifted remote migration-history table even though historical application schema is present. Stage 0.7A's schema was manually applied and verified separately. Local filenames previously used date-only versions (`20260730` three times and `20260811` twice), which are not unique migration identities.

This pass normalizes local versions only. It does not execute SQL, run `db push`, repair remote history, reset a database, or alter any migration SQL content.

## Deterministic local order

| Version | Description and main objects | Live-schema evidence | History action |
| --- | --- | --- | --- |
| `20260728090000` | Foundation credit ledger: `velto_credit_accounts`, `velto_credit_reservations`, `velto_credit_ledger`, credit RPCs and auth-user trigger | Historical credit flows and repository tests indicate use, but no live catalog evidence was captured in Stage 0.7 | **VERIFY BEFORE REPAIR** |
| `20260730100000` | Job queue: `velto_jobs` and enqueue/claim/heartbeat/complete/reschedule/fail RPCs | Historical queue operation is represented in the repository; no live catalog snapshot is attached | **VERIFY BEFORE REPAIR** |
| `20260730110000` | Job cancellation: `velto_job_cancel` RPC; ordered after job queue | No conclusive live function-definition evidence captured | **VERIFY BEFORE REPAIR** |
| `20260730120000` | Credit reconciliation: expiry, dispatch, settlement/release replacements, `velto_fin_reconcile` | Historical credit reconciliation code exists; no conclusive live function-definition evidence captured | **VERIFY BEFORE REPAIR** |
| `20260731090000` | Worker hardening: `velto_workers`, worker heartbeat/stop and queue-health RPCs; ordered after job queue | No conclusive live table/function catalog evidence captured | **VERIFY BEFORE REPAIR** |
| `20260811100000` | Creator music entitlements: `creator_music_entitlements` and service-role storage metadata model | Feature repository and production path exist; no conclusive live catalog evidence captured | **VERIFY BEFORE REPAIR** |
| `20260811110000` | Creator music usage outbox: `creator_music_usage_events`; depends on entitlements | Feature repository exists; no conclusive live catalog evidence captured | **VERIFY BEFORE REPAIR** |
| `20260818100000` | Stage 0.7A: `velto_media_assets`, `velto_media_asset_references`, replacement RPC and owner RLS | **Conclusive:** manually applied to live; reconciliation read/wrote 49 assets twice idempotently | Mark applied after manifest review |

The Stage 0.7A migration remains last because it depends on the pre-existing `velto_projects` schema and follows all tracked local migrations. The repository does not currently contain the historical migration that originally created `velto_projects`; this is a baseline uncertainty, not permission to recreate or alter that table.

## SQL-content integrity

Only filenames changed. SHA-256 values remain:

| Version | SHA-256 |
| --- | --- |
| `20260728090000` | `459cb55c26e55c60ce28435bb9bad4b3f7da35e1b1464daf600d08742f0fefc9` |
| `20260730100000` | `99ef660fb49f40a06d19a753a38110db086dc64eca5f206c15b9021be9e8dac3` |
| `20260730110000` | `8f37b245577cdaec57049d2fd1db73ce5010a5079596d819b08e763943feb55f` |
| `20260730120000` | `50862a6f4150d28a9d456dbc675c78980eef3b2f8747039a87b562a67c8b7dff` |
| `20260731090000` | `ee6ddff9756d1bc0ac7fcda86155078dc5c41aa354526ab37eb45ccfff230e73` |
| `20260811100000` | `4443276f2623ac02cc42192e2e8a3ab58af2d7ea6cb1e76ef5d18e3a54a6afac` |
| `20260811110000` | `297d7bc15fb550055fdd47b3cdd80941db67133be8ae5da7630a8823885149c3` |
| `20260818100000` | `3e251bea8d0c98c0fea59b68bc0fcf8e4684b9ab9474f08cc51a4bdc670d68c4` |

## Future repair plan — do not execute during implementation

After reviewing this manifest, the conclusively verified Stage 0.7A history entry can be marked without re-executing its SQL:

```sh
npx supabase migration repair 20260818100000 --status applied
```

The following commands are intentionally conditional. First verify every listed table/function against the live catalog and confirm its definition is compatible with the corresponding local SQL. Only then run the matching command, in order:

```sh
npx supabase migration repair 20260728090000 --status applied
npx supabase migration repair 20260730100000 --status applied
npx supabase migration repair 20260730110000 --status applied
npx supabase migration repair 20260730120000 --status applied
npx supabase migration repair 20260731090000 --status applied
npx supabase migration repair 20260811100000 --status applied
npx supabase migration repair 20260811110000 --status applied
```

Do not substitute `db push` or `db reset`. History repair records evidence; it must not be used to pretend unverified schema is present.
