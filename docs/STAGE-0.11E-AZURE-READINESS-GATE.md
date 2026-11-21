# Stage 0.11E — Azure readiness gate

## Decision

**0.12 DEFERRED.** Current production remains Vercel + Supabase + Railway. There is no measured capacity, cost, security/compliance, revenue/beta, or operational trigger for Azure, and Stage 0.11D still concludes `PLAN UPGRADE REQUIRED NOW: NO`.

This gate creates no Azure resource, deployment, subscription, DNS record, credential, SDK dependency, infrastructure template, or spend. A future rehearsal should default to **Azure runtime + existing Supabase DB/Auth/Storage**, isolated from canonical production and without destructive data migration.

## Current service and future-equivalent map

| Current component | Responsibility/state | Container readiness | Future Azure equivalent | Difficulty / portability risk |
| --- | --- | --- | --- | --- |
| Vercel Next.js web/API | UI, authenticated APIs, orchestration; stateless apart from external services | GREEN: Next standalone, non-root runner, health check, read-only root and `/tmp` cache | Container Apps or App Service | Low/AMBER: runtime portable; domain, callbacks, duration and ingress need rehearsal |
| Supabase Postgres | Canonical projects, media, economics, jobs and governance; stateful | N/A | Azure Database for PostgreSQL only if justified | High/AMBER: PostgreSQL portable, but RLS, functions, RPCs, indexes and transactional behavior require compatibility validation |
| Supabase Auth | Sessions, JWT validation, password reset; stateful identity | N/A | Keep Supabase Auth; replacement is a separate identity migration | High/AMBER: hybrid rehearsal avoids migration; redirect URLs must include staging origin |
| Supabase Storage | Public/private media, signed direct upload, asset metadata; stateful | N/A | Keep Supabase Storage; Blob Storage only if justified | High/AMBER: signed-upload/finalize flow, buckets, URLs, MIME/signature checks and governance metadata need a new adapter |
| Supabase RPC/job queue | Durable queue, leases, heartbeats, retry/reclaim; stateful | Worker runtime GREEN | Keep current RPC queue; Service Bus/Queue Storage only if separately justified | Medium/AMBER: `JobQueueRepository` exists, but worker directly calls Supabase RPCs today |
| Railway worker | Polling, claim/lease/retry, reconciliation and provider-status work; stateless process | GREEN: Node 22 worker target, non-root, SIGTERM drain, env config | Container Apps or Jobs | Low/AMBER: no business rewrite for hybrid; scale rule and health/metrics integration require rehearsal |
| Railway export/FFmpeg | Media download, FFmpeg render, governance/admission and durable upload; ephemeral state | GREEN container, AMBER sizing | Container Apps or appropriate compute | Medium/AMBER: non-root image, health and `/tmp` cleanup are portable; CPU/RAM/temp/duration must be measured |
| Observability | Structured logs, trace/request IDs, process metrics, queue/capacity/economics telemetry | Provider-neutral exporter seam | Azure Monitor/Application Insights via OpenTelemetry/export adapter | Low/AMBER: console JSON works immediately; durable metric export/correlation is not implemented |
| Secrets/config | Environment variables and internal service tokens | GREEN boundary | Container Apps/App Service settings + Key Vault references | Low/AMBER: values are platform-neutral; managed identity and rotation are untested |
| External providers | OpenAI, Exa, Pexels, Runway/Veo, ElevenLabs and optional music adapters | Env-configured HTTP/SDK adapters | Unchanged external providers | Low/GREEN: no routing change required; outbound networking and quotas need staging checks |

Relevant future capabilities were checked against current Microsoft documentation for [Container Apps scaling](https://learn.microsoft.com/en-us/azure/container-apps/scale-app), [Azure Database for PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/overview), [Blob user-delegation SAS](https://learn.microsoft.com/en-us/rest/api/storageservices/create-user-delegation-sas), and [Application Insights/OpenTelemetry](https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview). This is a compatibility map, not an implementation recommendation.

## Container and lifecycle readiness

- Web: `output: "standalone"`, port/hostname from environment, container health through `/api/runtime-health`, non-root process, read-only application root, writable ephemeral `/tmp`, and SIGTERM-compatible container execution. **GREEN.**
- Worker: Node 22 image target, environment-driven Supabase/internal endpoints, durable leases, no durable local filesystem, and SIGINT/SIGTERM stops new claims and persists stopping state. **GREEN for hybrid runtime; AMBER for scale-to-zero.** A polling worker at zero replicas has no event trigger to wake it; use a minimum replica or a proved queue scaler.
- Export: dedicated non-root FFmpeg image, `/health`, environment port, unique `os.tmpdir()` workspace, finally cleanup, and server close on SIGTERM. **GREEN container contract; AMBER operational readiness** until Azure CPU, memory, temp capacity, render P90 and request-duration behavior are measured.
- No durable state depends on local disk. Temp media is deliberately ephemeral. Container Apps Jobs may suit bounded offline work, but changing execution semantics is outside this gate.

## Configuration and secrets

Core Supabase, provider, worker, export, release and observability settings are environment-based. Provider credentials and Supabase service-role credentials remain server-only. Internal worker/export calls use separate shared tokens. Release identity accepts generic `VELTO_RELEASE` before platform fallbacks. No secret depends on Vercel or Railway secret APIs.

A rehearsal must map server secrets to Key Vault-backed application settings, use managed identity where supported, preserve public-vs-server Supabase key boundaries, rotate staging internal tokens independently, and verify that secret values never enter images/logs. Managed identity is an enhancement, not a prerequisite for the hybrid rehearsal.

## Data, Auth and Storage portability

PostgreSQL schema objects are portable in principle, but the product relies materially on Supabase RLS, Auth-issued identities, Storage buckets, RPC functions and service-role server access. Migrating only tables would be incomplete. Auth replacement is not justified and would require session/user/callback and ownership-policy redesign.

The signed direct-upload contract is application-governed but its signed target and object operations currently use Supabase Storage. Blob Storage could support a future adapter using short-lived, HTTPS-only user-delegation SAS, but the existing owner/project intent, size, MIME, signature, rights, finalize and idempotency invariants must remain authoritative. Existing persisted Supabase media URLs also need an inventory/rewrite or compatibility strategy before any Storage migration.

**Recommended future rehearsal:** keep Supabase Postgres/Auth/Storage/RPC canonical. Move only stateless web, worker and optionally export containers into an isolated Azure staging environment. This proves runtime portability without a destructive data migration.

## Network, domain and CORS checklist

- Allocate a staging-only HTTPS hostname; do not change production DNS.
- Add the exact staging origin to Supabase Site URL/additional redirect URLs and password-reset callbacks.
- Verify browser CORS for Supabase Storage signed uploads from that exact origin.
- Configure `VELTO_INTERNAL_BASE_URL` and `EXPORT_API_URL` to private or authenticated staging endpoints.
- Preserve internal worker/export tokens; do not expose service-role credentials to the browser.
- Restrict export ingress/CORS for staging rather than relying on its current wildcard CORS plus token alone.
- Verify provider outbound TLS/DNS, callback/webhook URLs where applicable, and signed-upload finalization across the Azure origin.

## Observability readiness

Existing request/trace IDs, structured redacted logs, queue health, worker heartbeats, provider metrics, capacity telemetry, economics attribution, web health and export health are portable. `ObservabilityExporter` provides a product-neutral seam, while worker/export already emit structured JSON. Application Insights supports OpenTelemetry, so a future exporter/collector can be added without rewriting product behavior.

Readiness is **AMBER** because web metrics are process-local, worker/export correlation has not been exercised across an Azure environment, and no Azure Monitor ingestion/resource exists. A rehearsal must prove release/trace correlation, health probes, queue/export dashboards and secret redaction before traffic.

## Rollback model

Canonical production stays on Vercel/Supabase/Railway. Azure staging uses a separate hostname, isolated secrets and no production traffic by default. Supabase remains canonical and no schema/storage migration occurs. Rollback is disabling the staging route/revision or routing staging traffic away, then revoking staging secrets. No database rollback or destructive synchronization is required. **GREEN.**

## Readiness scorecard

| Area | Status | Gate interpretation |
| --- | --- | --- |
| Web/API portability | GREEN | Existing standalone container can be rehearsed without product rewrite |
| Worker portability | GREEN | Hybrid runtime is portable; scale-to-zero trigger remains AMBER detail |
| Export portability | AMBER | Container ready; compute/temp/duration sizing unmeasured |
| DB portability | AMBER | PostgreSQL base is portable; Supabase RLS/RPC coupling is material |
| Auth portability | AMBER | Replacement is difficult, but keeping Supabase removes rehearsal blocker |
| Storage portability | AMBER | Adapter seam exists; signed uploads, URLs and governance require careful migration |
| Secrets/config | GREEN | Environment-based and platform-neutral; Key Vault mapping untested |
| Observability | AMBER | Export seam/structured telemetry exist; Azure ingestion unproved |
| Rollback | GREEN | Hybrid isolated staging can be disabled without data migration |
| Cost readiness | RED | No Azure quote, credits, workload measurement or TCO evidence justifies spend |

RED is a blocker for authorizing an Azure rehearsal, not a current product blocker.

## Economic and trigger gate

Current Azure trigger: **NO**. Azure plan/spend required now: **NO**.

- Cost trigger: none; Stage 0.11D has no current platform upgrade requirement and Azure TCO is unknown.
- Capacity trigger: none; only local stubbed concurrency is measured.
- Security/compliance trigger: none recorded.
- Revenue/beta trigger: none recorded.
- Operational trigger: none; current deployment has no measured blocker requiring relocation.

Microsoft for Startups is not assumed. Verified, sufficient Azure credits could reduce rehearsal cost, and technical support/architecture benefits could lower execution risk, but credits alone do not create a migration trigger. Later verification must confirm eligibility, amount, expiry, covered services/regions, support level and post-credit run rate before approving spend.

## Reopen criteria for Stage 0.12

Reopen only when at least one item has evidence and an owner/budget:

1. a sustained Vercel/Railway blocker that Azure runtime specifically resolves;
2. a security, compliance, residency, procurement or enterprise requirement;
3. a revenue-backed beta/contract requiring isolated Azure staging;
4. measured Azure-vs-current TCO showing a justified advantage;
5. verified Microsoft for Startups credits plus an approved, bounded rehearsal budget and success/rollback plan;
6. a resilience or regional-availability requirement that current architecture cannot meet economically.

Until then, optimize and observe the current Vercel/Supabase/Railway architecture. Stage 0.11F may close performance/scale readiness; it must not silently start Azure work.
