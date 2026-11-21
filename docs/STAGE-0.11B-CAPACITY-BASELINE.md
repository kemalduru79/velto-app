# Stage 0.11B capacity baseline

This slice measures local, deterministic, stubbed execution. It does not claim deployed capacity beyond tested levels and performs zero real-provider calls by default.

## Deployed-resource snapshot

| Surface | Repository-known setting | Deployment status |
| --- | --- | --- |
| Vercel | Next.js Node runtime; route-specific durations include 60s and Creator Package 120s; platform request-body boundary is approximately 4.5 MB | Plan, Fluid Compute and concurrency: deployment verification required |
| Supabase | Auth, Postgres, RPC and Storage adapters are configured; upload application limits are media-specific | Compute size, pooler mode/limits, Storage project limit and Auth quotas: deployment verification required |
| Railway worker | Serial claim/process loop; 2s default polling and 60s default lease | CPU, RAM, replicas, restart policy: deployment verification required |
| Railway export | Dedicated export service with health/runtime endpoints | CPU, RAM, replicas and service limits: deployment verification required |
| Providers | OpenAI, Exa, Pexels, image/video and voice adapters are present; economics remains authoritative | Account quotas/rate limits: deployment verification required |

The Creator upload route permits multipart bodies larger than Vercel's approximately 4.5 MB request boundary. A fixture immediately above that boundary is therefore classified as a deployed-path blocker until direct-to-storage or an equivalent bounded upload path is introduced. The application-level 51 MB multipart guard does not override the platform boundary.

## Safety

- Maximum concurrency: 10.
- Maximum iterations per scenario: 200.
- Maximum duration per operation: 60 seconds.
- Maximum fixture: 5 MiB.
- Paid providers are stubbed by default.
- Real-provider mode requires `VELTO_LOAD_ALLOW_REAL_PROVIDERS=I_UNDERSTAND_PAID_PROVIDER_COST`; the bulk harness still refuses to attach a real adapter.
- Result output contains scenario classes and generated request/trace IDs, never credentials or provider payloads.
