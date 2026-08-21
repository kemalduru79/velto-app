# Stage 0.8E Cloud Portability Baseline

This baseline describes the current deployment contract without making the current vendors permanent. Current production remains Vercel + Supabase + Railway.

## Runtime service map

### Web

- Next.js application built from the `runner` container target; default port `3000`.
- Liveness: `/api/runtime-health?mode=live`; readiness: `/api/runtime-health?mode=ready`.
- Stateless runtime. Writable temporary data belongs only under `/tmp`; persistent state is externalized.
- Current target: Vercel. The container remains portable to another compatible runtime.

### Worker

- Node worker with no public inbound HTTP requirement.
- Durable queue and state are Supabase-backed; internal communication uses `VELTO_INTERNAL_BASE_URL`.
- Handles graceful `SIGTERM` shutdown and keeps local runtime state ephemeral.
- Current target: a Railway-compatible container runtime. This document does not assert that Railway configuration exists in the repository.

### Export

- Separate `export-service` container; default port `3001`; health endpoint `/health`.
- Includes the native FFmpeg/ffprobe runtime, runs non-root, and supports a read-only root with writable `/tmp`.
- Final persistent media is written to Supabase Storage. Internal calls authenticate with the server-only `VELTO_INTERNAL_EXPORT_TOKEN`.
- Current target: a Railway-compatible container runtime.

## Durable dependencies and statelessness

Durable dependencies are Supabase Postgres, Supabase Auth, Supabase Storage, and external media or AI provider APIs where configured. No durable business state may depend on a container filesystem, instance hostname, process PID, Vercel-specific filesystem, or Railway-specific filesystem.

Web, worker, and export processes are stateless. Their local files are temporary and confined to `/tmp`; persistent application and final-media state is externalized.

## Cloud-neutral deployment contract

- Node 22 and locked dependencies.
- Environment-driven ports and internal service URLs.
- `VELTO_RELEASE` as the canonical release identity across cloud environments.
- Runtime secrets injected externally; no secrets baked into images.
- Stateless web, worker, and export processes using temporary filesystem storage only.
- Service health endpoints and graceful shutdown behavior.
- External persistence and cloud-neutral container images.

The baseline does not introduce vendor abstraction layers solely for abstraction.

## Current platform mapping

This mapping is current, not permanent:

- Web: Vercel.
- Database, Auth, and Storage: Supabase.
- Worker: Railway/container runtime.
- Export: Railway/container runtime.

## Azure Readiness — Deferred Deployment

No Azure resources are created in Stage 0.8E. This stage makes no Azure subscription changes and performs no Container Apps deployment, App Service deployment, Azure Database migration, Blob Storage migration, Key Vault integration, Azure Container Registry creation, Terraform, Bicep, ARM templates, Azure SDK addition, Azure CLI deployment, or production migration.

Future compatibility is conceptual only: the web container could run on an Azure-compatible container/web runtime; the worker on an Azure-compatible background container runtime; and export on an Azure-compatible container runtime with sufficient CPU, memory, and temporary storage for FFmpeg. Supabase may remain the database, Auth, and Storage provider during an initial future Azure staging rehearsal. No final Azure architecture is selected or provisioned here.

### Future Azure readiness gate

Before any Azure staging rehearsal, validate the service/container map, image architecture compatibility, environment and secrets inventory, internal service URL configuration, health/readiness endpoints, CPU/memory/temporary-storage sizing, FFmpeg runtime, networking and egress requirements, Supabase connectivity, provider API connectivity, domain/TLS, rollback plan, cost estimate, and Microsoft for Startups eligibility if relevant.
