# Stage 0.11D — Scale economics and capacity envelope

## Decision

**PLAN UPGRADE REQUIRED NOW: NO.** No deployed blocker, sustained AMBER trend, beta/revenue requirement, or security/compliance requirement has been measured. This is a bootstrap envelope, not a production-capacity claim. Azure remains deferred.

An upgrade decision changes only when dashboard evidence shows a platform limit or sustained AMBER approaching RED, a commercial beta requires a production-eligible plan, security/compliance requires it, or measured total-cost economics justify it. Unknown infrastructure cost is never treated as zero.

## Evidence boundaries

- **Measured:** Stage 0.11B local/stubbed workloads through concurrency 10 and Creator Package concurrency 3. These do not prove deployed capacity.
- **Tested contract:** Stage 0.11C direct signed uploads, bounded recovery, idempotency, and fail-closed partial failures.
- **Modeled:** every workload, monthly COGS estimate, user envelope, storage/egress estimate, and future concurrency row below.
- **Unknown:** the deployed Vercel/Supabase/Railway plan and dashboard usage, real database/worker/export P50/P90, retained storage, cache ratio, actual egress, and infrastructure allocation per project.

Current public plan facts were checked on 2026-09-01 against [Vercel Functions limits](https://vercel.com/docs/functions/limitations), [Vercel pricing](https://vercel.com/pricing), [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [Supabase pricing](https://supabase.com/pricing), and [Railway plans](https://docs.railway.com/pricing/plans). Deployment-plan pricing verification is still required.

## Canonical economics preserved

Credits remain entitlement units rather than dollars. Provider attempts retain actual/estimated COGS attribution; polling does not create cost. Finished minutes come from completed output duration, never provider-generated seconds. Standard remains stock/image/voice-first with zero automatic paid video; Pro and Cinematic retain selective scene-value routing. Quality remains primary. The canonical target is at least 65% gross margin, with approximately 60% as the P90 warning floor. Candidate prices remain Standard $59, Pro $199, and invitation-only Cinematic $399; they are beta benchmarks, not billing truth.

## Normalized monthly workloads

| Profile | Tier/revenue anchor | Projects × scenes | Finished min | Research | AI images | AI video | Voice min | Upload / stock | Final / package exports | Storage / egress pressure |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| Light Creator | Standard / $59 | 2 × 8 | 4 | 2 | 4 | 0 clips | 4 | 2 / 4 | 2 / 2 | 0.25 / 1 GB |
| Regular Creator | Pro / $199 | 6 × 10 | 24 | 6 | 30 | 6 × 7s efficient motion | 24 | 8 / 20 | 6 / 6 | 1.5 / 5 GB |
| Power Creator | Cinematic / $399 | 12 × 12 | 72 | 12 | 100 | 26 × 7s precision, 9 × 8s fast, 1 × 8s hero | 72 | 20 / 40 | 12 / 12 | 6 / 25 GB |
| Small Beta Cohort | 2 Light + 2 Regular + 1 Power / $915 | 28 projects, 296 scenes | 128 | 28 | 168 | 346 generated sec | 128 | 40 / 88 | 28 / 28 | 9.5 / 37 GB |

Assumptions: 900 voice characters per finished minute; research uses 6,000 input and 1,500 output tokens per run with 20% cached input; image usage uses the existing package model's 250 text-input and 3,000 image-output tokens; retry multipliers are 5%, 8%, and 12%. Storage is retained-media pressure, not a measured bill, and egress includes likely review/export access. Stock provider COGS remains non-billable; storage and transfer remain infrastructure unknowns.

## Modeled COGS and margin

| Profile | Known provider COGS | Infrastructure | Total monthly COGS | Known COGS/project | Known COGS/finished min | Provider-only GM | Status |
| --- | ---: | --- | --- | ---: | ---: | ---: | --- |
| Light | $0.770133 | verification required | unknown | $0.385067 | $0.192533 | 98.69% | GREEN, provisional |
| Regular | $7.584710 | verification required | unknown | $1.264118 | $0.316030 | 96.19% | GREEN, provisional |
| Power | $55.256051 | verification required | unknown | $4.604671 | $0.767445 | 86.15% | GREEN, provisional |
| Small Beta | $71.965737 | verification required | unknown | $2.570205 | $0.562232 | 92.13% | GREEN, provisional |

These are known-provider subtotals, not accounting gross margin. All remain above the 65% target on known provider COGS, but infrastructure, storage, egress, export runtime, taxes, and support are absent. The result becomes AMBER at less than 65% and RED below the 60% P90 floor after complete cost allocation. No quality reduction is authorized as a margin remedy.

## Platform envelopes and first triggers

### Vercel

- **Private use: GREEN.** The active upload flow bypasses the 4.5 MB Function payload limit. Hobby publicly includes 4 active CPU hours, 360 GB-hours memory, 1M invocations, and 100 GB transfer, but the actual deployed plan/usage is unknown.
- **Early beta: AMBER.** Synthetic concurrency is not deployed evidence. Hobby is documented for personal/non-commercial use; a commercial beta is itself a plan-eligibility trigger even before resource exhaustion.
- **Triggers:** P90 function duration near route limits, 413s, throttling, invocation/CPU/memory/transfer above 70% for two observation windows, or commercial beta plan eligibility.
- **Smallest next action:** inspect Usage/Fluid Compute configuration; upgrade only the Vercel plan if a measured or commercial trigger exists.

### Supabase

- **Private use: GREEN with monitoring.** Free currently documents 500 MB database, 1 GB Storage, 5 GB uncached plus 5 GB cached egress, and 50 MB maximum file upload. Direct signed uploads preserve the 15/50 MiB product limits.
- **Early beta: AMBER-to-RED on Free depending retention.** The modeled five-user cohort creates 9.5 GB monthly storage pressure and 37 GB egress; without lifecycle cleanup/reuse, that exceeds Free allowances. This is modeled pressure, not observed retained usage.
- **Triggers:** database/storage/egress above 70% for two windows; DB P90 latency >500 ms; connection/pool saturation; Auth restriction; repeated signed-upload/storage failures.
- **Smallest next action:** verify dashboard plan and retained bytes. If beta retention actually exceeds Free, upgrade Supabase only; do not change schema or routing preemptively.

### Railway

- **Private use: GREEN/AMBER.** Hobby is currently $5/month including $5 resource usage, billed by RAM, CPU, egress, and volume consumption. Actual deployed plan and service consumption are unknown.
- **Early beta: AMBER.** Worker processing is serial per process and export duration/resource use is unmeasured in deployment.
- **Triggers:** queue-wait P90 >60s for two windows, sustained CPU >70%, sustained memory >80%, export P90 >45s or repeated 55s proxy timeout exposure, restart/failure >2%, or backlog growth across 15 minutes.
- **Smallest next action:** right-size the affected service, then add one worker/export replica only when queue or runtime evidence requires it; change Railway plan only if its ceiling blocks that action.

### Providers

- **Triggers:** 429 rate >1%, provider P90 latency >30s, quota exhaustion, retry amplification >10%, or provider COGS moving a workload below 65% GM.
- **Smallest next action:** inspect quota and bounded retry telemetry; do not bulk-load paid providers or change routing without quality-equivalent evidence.

## Concurrency and capacity × economics matrix

| Scenario | Evidence | Capacity | Provider cost | Export | Storage | Margin | Operational risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Private / 1 user | modeled from tested contracts | GREEN | Light workload GREEN | AMBER until deployed timing | GREEN if retained <1 GB | provisional GREEN | low with monitoring |
| 5-user beta | modeled; not load-measured in deployment | AMBER | cohort $71.97 known | AMBER | RED on Supabase Free if 9.5 GB retained | provisional GREEN | AMBER; conditional beta |
| 10-user beta | local concurrency 10 measured only with stubs; production unproven | AMBER/RED | modeled roughly 2× cohort mix | AMBER/RED | RED on Free without lifecycle control | provisional, workload-mix dependent | deployed proof required |
| 25-user future | hypothetical | RED / not proven | unknown until tier mix is fixed | RED / not proven | RED on minimum tiers | unknown | architecture/plan review required |

Creator Package concurrency 3 is measured locally with synthetic fixtures only. Defensible private use is one active creator. Five-user beta is conditional on dashboards, storage retention, and export/queue telemetry. Ten-user production concurrency and all 25-user claims remain not proven.

## Bootstrap upgrade policy

Do not upgrade because a plan is free, another tier exists, or future scale is imaginable. Upgrade only for a measured blocker, sustained AMBER near RED, an actual beta/revenue requirement, a security/compliance requirement, or favorable measured total-cost economics. Require two observation windows unless the trigger is a hard failure, security issue, or commercial-plan restriction. Upgrade the single constrained platform and choose the smallest action first.

**Exact decision-changing event:** a hard platform failure, commercial beta eligibility requirement, or two consecutive monitoring windows crossing one of the service thresholds above. No such evidence exists in this slice.

## Azure boundary and remaining unknowns

No current capacity or economic result creates an Azure trigger. Stage 0.11E may evaluate Azure only if measured sustained demand, compliance/residency, enterprise procurement, multi-region resilience, or comparative total-cost evidence warrants it. It must not deploy Azure by default.

Remaining unknowns: actual plans and regions; Vercel Fluid Compute settings/usage; Supabase retained storage, cache ratio, DB size/connections/P90; Railway CPU/RAM/restarts/queue/export P90; real tier mix; retry/fallback distribution; actual infrastructure COGS per finished minute; support and tax allocation. Stage 0.11E should collect these read-only deployment measurements without paid-provider bulk load.
