# Stage 0.11F — Stage 0.11 closure and Go/No-Go

## Decision

**STAGE 0.11 GO.** The current bootstrap architecture is operationally defensible for private/internal CreatorLab production. Controlled early beta is a conditional go with deployed telemetry and retention checks. This decision does not prove 10-user, 25-user, or public-launch capacity, require a plan upgrade, authorize Azure spend, or start Stage 0.12.

Baseline commit: `bd24c643e89af52f50b1146f35e9eaffb0dfba92`.

## Stage-by-stage closure

| Stage | Status | Canonical finding |
| --- | --- | --- |
| 0.11A — Performance & Capacity Baseline | CLOSED | Performance/capacity surfaces, observability needs, bootstrap constraints, and the requirement to separate measured evidence from deployed claims were established. |
| 0.11B — Load & Concurrency Baseline | CLOSED | Deterministic, provider-stubbed local workloads were exercised through concurrency 10; Creator Package was exercised through concurrency 3. These are synthetic measurements, not deployed-capacity claims. |
| 0.11C — Bottleneck, Reliability & Recovery | CLOSED | Direct signed upload removed the Vercel request-body blocker; bounded retry, lease/reclaim, idempotency, partial-failure, package, and export contracts fail closed in tests. Deployed queue/export behavior remains AMBER. |
| 0.11D — Scale Economics & Capacity Envelope | CLOSED | Known-provider workload models remain above the 65% gross-margin target. Infrastructure cost remains unknown, no quality reduction is authorized, and no plan upgrade is currently required. |
| 0.11E — Azure Readiness Gate | CLOSED | Runtime portability is documented, but no capacity, economics, compliance, revenue, or operational trigger authorizes Azure. Stage 0.12 remains deferred. |
| Pre-0.11F CreatorLab credit-gating cleanup | CLOSED | Creator-facing payment/balance gating is retired. Six active CreatorLab provider/export routes use accounting-only admission, while COGS, idempotency, reconciliation, ambiguity handling, dispatch protection, Production Allowance, and the legacy balance-backed engine remain intact. |

## Current product and architecture contract

- Vercel + Supabase + Railway remains canonical. Vercel serves the Next.js web/API runtime; Supabase remains canonical for Auth, Postgres, Storage, RLS/RPC and durable state; Railway runs the worker and export/FFmpeg services.
- Creator Upload uses a non-upserting signed direct Supabase Storage upload followed by authenticated finalization. Product limits remain 15 MiB for images and 50 MiB for videos. The active upload flow has no Vercel-body hard gate.
- Creator-facing credits, Available/Reserved presentation and active `/api/credits` polling are retired. A zero balance cannot block normal CreatorLab production.
- The legacy balance-backed credit engine remains backstage for possible future commercial reactivation. CreatorLab admission does not grant, top up, drive negative, or mutate a credit balance.
- Provider-cost attribution, economic-operation records, COGS aggregation, idempotency, reconciliation, ambiguous-outcome handling and duplicate paid-dispatch protection remain active. `CREATOR_PRODUCTION_ALLOWANCE_EXCEEDED` remains an active safeguard.
- Providers and provider routing remain backstage and unchanged. There is no Azure dependency and no current plan-upgrade dependency.

## Capacity evidence boundary

### Measured

- Local deterministic synthetic workloads with stubbed providers through concurrency 10.
- Creator Package synthetic fixtures through concurrency 3.
- Reliability/recovery contracts for signed-upload finalization, bounded provider failure, serial worker lease/reclaim, duplicate-operation coalescing, partial persistence/storage failure, package/export timeout and temporary-artifact cleanup.

### Defensible

- Private/internal use by one active creator, with current monitoring and accepted AMBERs.

### Modeled

- Five-user beta: conditional and AMBER; the modeled cohort has $71.965737 known provider COGS, 9.5 GB monthly retained-storage pressure and 37 GB egress pressure.
- Ten-user beta: modeled and not proven in deployment; local stub concurrency 10 is not equivalent to deployed production capacity.
- Twenty-five-user future scenario: hypothetical and not proven; architecture/plan review is required before making a capacity claim.

### Unknown

- Deployed Supabase compute, connection/pool, database, Storage and egress behavior.
- Railway worker/export CPU, RAM, restart behavior and actual service limits.
- Real worker queue-wait P90 and real FFmpeg/export P90.
- Actual retained storage, egress/cache ratio and tier mix.
- Infrastructure COGS allocation per project and finished minute, including storage, transfer and export runtime.

Modeled capacity must not be represented as measured production evidence.

## Reliability closure

| Surface | Closure state | Remaining interpretation |
| --- | --- | --- |
| Creator Upload | GREEN contract / AMBER deployed verification | Signed direct upload removes the prior RED; deployed bucket behavior and orphan cleanup require monitoring. |
| Worker lease/recovery | GREEN synthetic / AMBER operational | Lease/reclaim prevents duplicate active execution in the tested contract; deployed recovery timing is unknown. |
| Provider failure handling | GREEN | Timeout, rate-limit, server, network and malformed responses remain bounded and fail closed. |
| DB/Storage partial failure | GREEN synthetic / AMBER operational | No false Ready state; deployed outage behavior remains unmeasured. |
| Creator Package | GREEN synthetic / AMBER deployed capacity | Concurrency 3 passes locally; deployed resource timing is unknown. |
| Final export | GREEN correctness / AMBER operational | Cleanup and failure handling pass; deployed FFmpeg P90 and the 55-second proxy exposure remain unknown. |
| Duplicate dispatch protection | GREEN | Durable claims and idempotent execution prevent duplicate paid dispatch. |
| Economics reconciliation | GREEN | Cost attribution and reconciliation remain active, including ambiguous provider outcomes. |
| Zero-credit admission | GREEN | Accounting-only admission does not inspect or mutate a CreatorLab credit balance. |

No unresolved RED remains for current private/internal product use. AMBER means monitored or unmeasured deployment behavior; it must not be relabeled GREEN without evidence.

## Economics closure

- Target gross margin: **at least 65%**.
- P90 warning floor: **approximately 60%** after complete cost allocation.
- Known-provider models remain above target: Light 98.69%, Regular 96.19%, Power 86.15%, and modeled five-user cohort 92.13% provider-only gross margin.
- Infrastructure cost is **UNKNOWN, not zero**. Therefore these margins are provisional rather than final accounting gross margin.
- No plan upgrade or quality reduction is required now. No current economics finding creates an Azure cost trigger.

## Infrastructure Go/No-Go

| Platform | Current status | Unresolved risk | Exact action trigger | Action now |
| --- | --- | --- | --- | --- |
| Vercel | GREEN private / AMBER beta | Actual plan, Fluid Compute and deployed duration/usage are unknown | 413/throttling; P90 near route limits; CPU, memory, invocation or transfer above 70% for two windows; or commercial-beta plan eligibility | NO |
| Supabase | GREEN private / AMBER beta | Retention, DB/pool latency and egress may exceed minimum-tier limits | DB, Storage or egress above 70% for two windows; DB P90 >500 ms; connection saturation; Auth restriction; repeated signed-upload/storage failure | NO |
| Railway | GREEN/AMBER private / AMBER beta | Serial-worker pressure and export resource timing are unmeasured | Queue-wait P90 >60s for two windows; CPU >70%; memory >80%; export P90 >45s; repeated 55s exposure; failures >2%; or backlog growth for 15 minutes | NO |
| External providers | GREEN bounded contract / AMBER deployed quotas | Real quotas, latency and workload retry mix are unknown | 429 rate >1%; provider P90 >30s; quota exhaustion; retry amplification >10%; or provider COGS reducing a workload below 65% gross margin | NO |

Upgrade only the constrained platform, and choose the smallest sufficient action. Require two observation windows unless the trigger is a hard failure, security issue or commercial-plan restriction.

## Use and scale decisions

`PRIVATE/INTERNAL USE: GO`

`CONTROLLED EARLY BETA: CONDITIONAL GO`

Conditions: verify deployed plan eligibility; establish Vercel/Supabase/Railway dashboards; monitor retained Storage/egress, DB latency/connections, queue-wait P90, worker CPU/RAM/restarts, export P90/failures and full infrastructure COGS; keep beta bounded; and stop expansion when a hard limit or the documented thresholds are crossed.

- 10-user deployment: **NOT PROVEN**. Stubbed concurrency 10 is not deployed evidence.
- 25-user deployment: **NOT PROVEN**. It remains a future modeled scenario.
- Broader public launch: **NOT PROVEN / NO-GO without a separate evidence-backed launch gate**.

## Accepted AMBERs

| Risk | Why it is not currently a blocker | Metric | Trigger | Smallest next action |
| --- | --- | --- | --- | --- |
| Supabase retained storage/egress | Private usage can remain bounded; beta pressure is modeled, not observed | Retained bytes, DB bytes, cached/uncached egress | Above 70% for two windows or retention exceeding plan allowance | Inspect dashboard and apply lifecycle/reuse discipline; upgrade Supabase only if measured need persists |
| Railway worker pressure | Serial processing is correct for current private use | Queue P90, backlog age, CPU, RAM, restarts | Queue P90 >60s twice, backlog growth for 15m, CPU >70%, RAM >80%, failures >2% | Right-size the affected service; add one replica only when measured |
| FFmpeg/export timing | Correctness and cleanup pass synthetically | Export P50/P90, failure/timeout rate, temp/RAM pressure | P90 >45s or repeated 55s proxy exposure | Measure deployed export; right-size export service only if triggered |
| Deployed queue wait/recovery | Lease/reclaim is proved synthetically | Claim wait, recovery time, duplicate execution, terminal failures | P90 >60s twice, duplicate paid execution, or failure >2% | Inspect queue/worker telemetry and tune/scale the narrow bottleneck |
| Infrastructure COGS | Known provider costs leave substantial provisional margin | Total COGS/project and finished minute, allocated storage/egress/export cost, P90 GM | GM <65% AMBER; P90 below ~60% RED | Allocate actual infrastructure cost before pricing or plan action |
| Actual beta concurrency | Five users are modeled only | Concurrent requests/jobs, route P90, error/throttle rate | Sustained threshold crossing or hard platform failure | Run a bounded deployed, stub-safe observation before expanding cohort |
| Orphan direct uploads after an expired finalize intent | Orphans never become canonical/Ready assets and do not corrupt ownership state | Unfinalized object count/bytes and age | Repeated accumulation or material storage pressure | Add a bounded age-based orphan inventory/cleanup procedure before beta expansion |

## Rejected or removed REDs

- The Vercel multipart upload body-limit blocker was removed by signed direct Supabase upload.
- Zero-credit CreatorLab production blocking was removed by accounting-only admission across six active provider/export routes.
- Duplicate paid dispatch, false Ready state after partial failure, unbounded provider retry and unreconciled ambiguous cost exposure remain protected by existing contracts and tests.
- Azure cost readiness remains RED only for authorizing Azure spend; it is not a current-product RED because Azure is not required.

## Azure and Stage 0.12

`STAGE 0.12 AZURE STAGING REHEARSAL: DEFERRED`

There is no Azure deployment, resource, credential, dependency or spend. Reopen Stage 0.12 only with evidence plus an owner and budget for at least one of: a sustained current-platform blocker Azure specifically resolves; a compliance/residency/procurement requirement; a revenue-backed contract requiring isolated Azure staging; favorable measured Azure-versus-current TCO; verified startup credits plus an approved bounded rehearsal and rollback plan; or a resilience/region requirement the current architecture cannot meet economically.

## Exact Stage 0.11 reopen triggers

Reopen Stage 0.11 only for concrete regression evidence or a decision-changing event:

1. a correctness, security, ownership, idempotency, reconciliation or zero-credit admission regression;
2. a hard Vercel, Supabase, Railway or provider failure;
3. two consecutive observation windows crossing any platform threshold above;
4. complete-cost gross margin below 65%, or P90 margin below approximately 60%;
5. commercial beta, revenue, security or compliance requirements that the current plan cannot satisfy;
6. evidence that 10-user, 25-user or public scale must be supported beyond the current measured envelope;
7. an explicit evidence-backed Stage 0.12 trigger.

Accepted AMBERs remain bounded and non-blocking only while monitored and below their triggers.
