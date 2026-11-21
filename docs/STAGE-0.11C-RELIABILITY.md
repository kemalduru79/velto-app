# Stage 0.11C reliability baseline

## Creator Upload

The previous multipart route crossed Vercel's approximately 4.5 MB request boundary while application policy permits 15 MiB images and 50 MiB videos. CreatorLab now uses the existing authenticated route for two small JSON control requests and uploads media directly to Supabase Storage through a non-upserting signed target.

The server signs an immutable 15-minute intent containing owner, project, unique path, media kind, MIME type, byte size, rights confirmation and presentation metadata. Finalization authenticates the owner again, rechecks project ownership, verifies Storage metadata, downloads the object for canonical signature validation, and registers `velto_media_assets` only after every check passes. Duplicate finalization resolves the existing physical asset. Invalid or unregistrable objects receive best-effort cleanup and never bind to a scene.

The Supabase signed upload token itself follows the platform's two-hour validity contract. The shorter Velto intent controls whether an uploaded object may be finalized into canonical state.

## Reliability classification

| Surface | Status | Cause/classification |
| --- | --- | --- |
| Creator Upload | GREEN for tested application contract; deployed verification required | Previous code/architecture blocker removed; Supabase bucket limits and deployed direct upload require live verification |
| Worker queue/recovery | GREEN for synthetic lease/reclaim contract; AMBER operationally | Single active job per process is intentional; deployed Railway recovery timing remains unmeasured |
| Creator Package | GREEN for synthetic fixtures through concurrency 3 | In-process resource telemetry remains active |
| FFmpeg/final export | AMBER | Synchronous Vercel wait has a 55-second proxy ceiling; no deployed timeout evidence was collected in this slice |
| Provider failures | GREEN for bounded stub contracts | Timeout, 429, 5xx, malformed and network cases remain fail-closed with bounded attempts |
| DB/Storage partial failure | GREEN for synthetic contract; AMBER operationally | No false Ready state; deployed outage behavior remains to be observed |

No plan upgrade is required by the evidence in this slice. Stage 0.11D should verify the signed upload flow and Railway/Supabase recovery metrics in the deployed bootstrap environment without paid-provider bulk load.
