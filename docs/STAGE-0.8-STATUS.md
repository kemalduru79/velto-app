# Stage 0.8 — Production Foundation & Portability

## Canonical structure

- 0.8A — CI/CD & Automated Quality Gates
- 0.8B — Containerization
- 0.8C — Service Modularization
- 0.8D — Configuration / Secrets Standardization
- 0.8E — Cloud Portability & Azure-Readiness Baseline
- 0.8F — Observability / Health / Recovery Foundation
- 0.8G — Stage 0.8 Closure & Architecture Validation

The current production target remains Vercel + Supabase + Railway. Azure deployment is deferred. Stage 0.8 must preserve Azure portability while introducing no Azure resources and keeping Azure cost at €0.

## Current status

- 0.8A: CLOSED/PASS
- 0.8B: CLOSED/PASS
- 0.8C: CLOSED/PASS
- 0.8D: CLOSED/PASS
- 0.8E: CLOSED/PASS
- 0.8F: IN PROGRESS
  - 0.8F-A Health & Observability Consistency: CLOSED/PASS
  - 0.8F-B Recovery & Operator Baseline: current

Current production target remains Vercel + Supabase + Railway. Azure deployment is deferred. Azure cost remains €0.

## 0.8A — CI/CD & Automated Quality Gates

`Velto CI` runs for pull requests targeting `main`, pushes to `main` and `agent/**`, and manual dispatches. A single economical Ubuntu job uses Node.js 22, `npm ci`, npm lockfile caching, a 30-minute timeout, and concurrency cancellation.

The ordered gates are:

1. Full TypeScript typecheck (`tsc --noEmit`).
2. Deterministic no-new-lint-debt validation for changed JavaScript/TypeScript source **lines**. ESLint runs per touched file, but only error-level findings that overlap added/modified lines (plus fatal/parser/configuration failures) are new-debt failures. Existing findings outside the changed ranges do not become failures merely because a large legacy file was edited. The Stage 0.7 closure commit `704bc5fa449269244f717a3967dcbcb54f1bb42f` is the historical floor when `main` predates the 0.8A branch, preventing old branch history from being reclassified as new lint debt. Full repository ESLint is not the 0.8A baseline because the existing whole-tree invocation exceeds a 4 GB Node heap.
3. A curated offline regression suite covering Stage 0.6 Smart Asset Reuse; Stage 0.7 ownership, metering, trash/restore, quota, purge, entitlement, admission, activation, migration, and export contracts; creator video lifecycle/replay safety; final video lifecycle; and Cost Guard.
4. The Next.js production build. GitHub CI supplies only non-production public Supabase placeholders required by browser-client module initialization during prerender; they do not target a live project and are not credentials.
5. A static CI contract self-test.

The workflow has top-level `contents: read` permission and checkout credential persistence is disabled. It contains no production credentials or secret references. It performs no live Supabase or Storage operations, provider generation, credit-consuming calls, deployment, migration mutation, or cloud-resource creation.

Read-only live infrastructure checks, live mutation/reconciliation/purge/admission scripts, localhost runtime smoke tests, provider/cost tests, worker/scale tests, and operator/admin tools are intentionally excluded. These categories require infrastructure, credentials, mutation authority, a running service, or could create cost; 0.8A validates code offline only.

Run the same gate locally after installing locked dependencies:

```sh
npm ci
npm run ci:quality
```
