# Stage 0.8 Architecture Closure

## Objective

Stage 0.8 establishes a portable production foundation without changing Velto's product behavior or prematurely introducing cloud-specific infrastructure. It closes the gaps in automated quality, containers, service boundaries, runtime configuration, provider portability, health, observability, recovery, and operator guidance.

## Final runtime topology

### Web

The stateless Next.js web runtime uses Node.js 22, serves the product UI and HTTP API on port 3000, and exposes live and ready health endpoints. It remains deployable on its current Vercel target and as the standalone, container-ready, non-root `runner` target in the root Dockerfile. Durable state is external; the application filesystem is read-only in the portable Compose baseline, with `/tmp` as the only writable temporary area.

### Worker

The Node.js 22 worker is a separate process built from the root Dockerfile's `worker` target and requires no public HTTP endpoint. It consumes the durable Postgres-backed production queue/state with horizontal worker support and canonical lease, heartbeat, cancellation, retry, recovery, credit, reconciliation, logging, metric, and graceful SIGTERM behavior. It runs as the non-root `node` user, is read-only-root compatible, receives only its least-privilege runtime configuration, and targets a Railway-compatible runtime today.

### Export

The independent Node.js 22 export service listens on port 3001 and is built from `export-service/Dockerfile`. It preserves the existing stitch-video contract, native FFmpeg/ffprobe behavior, temporary-file cleanup, health endpoint, and graceful shutdown. It runs as the non-root `node` user, is read-only-root compatible with writable `/tmp`, and targets a Railway-compatible runtime today.

## Architectural style

Velto remains a **MODULAR MONOLITH** with separately deployable runtime processes. The web, worker, and export processes share one repository, release contract, product/domain model, and persistence boundary; this is not a microservices architecture. Web Creator production, Director, and scene-refinement HTTP boundaries became thinner as business logic moved into services. The stitch-video HTTP boundary is thin, with native media resolution and stitching orchestration isolated behind service modules, and the worker runtime is modularized.

## Persistence

Durable business state remains externalized in Supabase Postgres, Supabase Auth, and Supabase Storage; no durable state relies on a local container filesystem. Persistence factories and adapter seams isolate access, but the current implemented persistence driver remains Supabase and those seams do not imply that other database implementations exist. Stage 0.8 adds no new database migration, storage lifecycle, or data ownership behavior.

## Runtime configuration and secrets

Canonical runtime environment validation defines required and optional configuration, normalizes aliases, and fails closed where runtime authority is required. Server and browser Supabase values follow documented precedence; the worker receives a least-privilege environment. `VELTO_RELEASE` is the canonical cloud-neutral release identity. Secrets are injected externally at runtime: they are not embedded in images, committed to source, printed by health endpoints, or supplied to offline CI.

## Optional provider boundary

Optional media and AI providers are selected internally through the standardized provider environment boundary. Provider environment aliases, availability, and validation remain normalized, explicit, and cloud-neutral, with no new user-facing provider exposure. Stage 0.8 does not change models, prompts, routing intelligence, economics, tiers, or provider behavior.

## CI and quality gates

`Velto CI` uses Node.js 22 and locked dependencies to run TypeScript, deterministic no-new-lint-debt checks, critical offline regressions, the production build, and the CI contract. It uses read-only repository permission, persists no checkout credential, requires no production secret, and performs no live mutation, deployment, provider call, or cloud-resource operation.

## Runtime safety

Production images use Node.js 22, non-root users, explicit health checks, signal-aware process entrypoints, and narrow runtime contents. The portable Compose baseline makes application filesystems read-only and reserves `/tmp` for bounded runtime files. Export cleanup and native ffmpeg/ffprobe resolution preserve the validated AMD64 and ARM64 behavior and the Vercel function-size constraint.

## Observability and recovery

Web, worker, and export expose canonical release identity and consistent health semantics without leaking secrets. Structured console JSON observability, redaction, traces, and metrics provide the current foundation; no enterprise monitoring or alerting system is implied. Authenticated operational health and the safe operator runbook cover detection, triage, rollback, restart, queue safety, export cleanup, and post-recovery verification. Financial reconciliation is preview-before-apply, while media and purge recovery procedures fail closed and keep destructive actions manual and explicitly authorized.

## Cloud portability

The current production target remains Vercel + Supabase + Railway. The container and configuration contracts provide a cloud-neutral deployment baseline and retain future Azure portability, but Stage 0.8 creates no Azure resources, adds no Azure SDK, Terraform, Bicep, or ARM template, and keeps Azure cost at €0.

## Deferred work and non-goals

- Stage 0.9: security, consent, legal, and data-lifecycle work.
- Stage 0.10: CreatorLab production/productization, stock or licensed video, production-tier optimization, and Smart Premium Routing.
- Stage 0.11: controlled alpha operations.
- Stage 0.12: Azure readiness gate and staging preparation only.

Stage 0.8 does not split the modular monolith into microservices, redesign the export service, change product behavior, add providers, change persistence semantics, or perform a production migration or deployment.

## Closure decision

Stage 0.8 is **CLOSED / PASS**. The final deterministic regression suite passed, and closure commit `2dd3548f7fe3fa0084cc27d045412cb6563775bf` passed GitHub CI run `32522776885` and Vercel validation on the same SHA. The branch was clean and locally/remotely aligned at closure, and no unresolved P0/P1 architecture blocker remained. The current production target remains Vercel + Supabase + Railway; Azure deployment remains deferred with no Azure resources introduced.
