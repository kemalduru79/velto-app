# Stage 0.8F Recovery and Operator Baseline

## Observe first

Capture evidence before changing state. Identify the affected service and its canonical `VELTO_RELEASE`, record health, and never expose or paste secrets into incident notes.

## Health triage

- Web: `/api/runtime-health?mode=live` and `/api/runtime-health?mode=ready`.
- Operational observability: `/api/observability/health`; this remains authenticated and operational-token protected.
- CreatorLab operational status: `/api/creator-health`.
- Export service: `/health`.

Recovery order:

1. Identify the failing service and release.
2. Check runtime health and durable dependency availability.
3. Restart or redeploy only the affected stateless service when appropriate.
4. Re-check health.
5. Only then consider durable-state reconciliation.

No automated restart or deployment behavior is introduced by this baseline.

## Worker and queue recovery

Jobs are durable in Postgres. A worker restart does not intentionally discard queued jobs; lease expiry supports recovery, and retry/rescheduling already exists. Operators must not manually edit queue rows as normal recovery practice.

If queue state is uncertain, inspect authenticated observability and queue health. Restart the worker only when its runtime is unhealthy, allow existing lease and reconciliation mechanisms to operate, and escalate instead of guessing database state.

## Financial recovery

Safe preview, requiring no credentials: the preview performs no database operation.

```sh
npm run fin:reconcile
```

Explicit mutation after evidence review:

```sh
npm run fin:reconcile:apply
```

Apply invokes the existing `velto_fin_reconcile` RPC. Use manual apply only when incident evidence warrants it; automatic worker reconciliation remains the normal background mechanism. Never directly edit credit tables.

## Media registry reconciliation

First run the audit:

```sh
node --env-file=.env.local scripts/stage-0-7a-reconcile-media.mjs
```

Only after reviewing ownership and unresolved output:

```sh
node --env-file=.env.local scripts/stage-0-7a-reconcile-media.mjs --apply
```

Never guess ownership. Unresolved or ambiguous ownership requires STOP and escalation. Registry reconciliation does not justify deleting Storage objects.

## Purge coordination recovery

Inspect first:

```sh
node --env-file=.env.local scripts/stage-0-7d-1-purge-recovery.mjs
```

Apply only after reviewing the inspection:

```sh
node --env-file=.env.local scripts/stage-0-7d-1-purge-recovery.mjs --apply
```

- `OBJECT_PRESENT`: do not finalize purge.
- `OBJECT_MISSING`: eligible for registry completion only when coordination evidence matches.
- `UNKNOWN_ERROR`: STOP and investigate.

Apply is not a general cleanup command.

### Live purge smoke warning

`scripts/stage-0-7d-1-live-physical-purge-smoke.mjs` is a controlled synthetic disposable test only. It is not a user-media recovery command, general cleanup tool, or routine production operation. Never repurpose it for existing customer or user assets.

Physical permanent deletion remains separately feature-controlled and disabled by default unless explicitly enabled. Trash itself does not free storage. Never bypass lifecycle or reference safeguards.

## Application rollback

For an application/runtime regression, identify the previous known-good release or SHA, use the current hosting platform's normal rollback/redeploy capability, and verify health afterward. This baseline creates no rollback automation and changes no Vercel, Railway, or Azure resources.

Database migrations must not be automatically rolled back. Schema or data recovery requires a separate reviewed action; application rollback never implies database rollback.

## Incident evidence checklist

Record the timestamp, service, current release SHA, previous known-good release when known, health status, relevant queue health/counts, command executed, `NO_MUTATION` or `APPLY` mode, outcome, and remaining recovery requirement. Never record secret values.

## STOP and escalation conditions

STOP for ownership ambiguity, `UNKNOWN_ERROR`, unexpected schema/state, reconciliation output that materially differs from expectations, unprovable physical object state, any operation requiring manual edits to durable production rows, or an unclear rollback path. Fail closed; do not guess.
