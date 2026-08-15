# UX-P2D Status

## UX-P2D-1 — Publish Workspace

### Publish information architecture

Publish remains Step 5 of the accepted CreatorLab workflow and is organized as a finalization workspace: Publish Readiness, Publish Package previews and copy, release validation, package contents, then the concluding export action. The project title and existing format, runtime, scene count, and final-video state establish page identity without introducing new readiness calculations.

### Reused readiness model

The concise Ready, Needs Attention, and Outdated presentation is derived only from the existing `creatorPublishSystemChecks`, creator confirmations, final-video reuse state, and authoritative `export_outdated` lifecycle status. It does not persist new flags or replace the existing project/export readiness utilities. Only pending existing checks and confirmations are summarized near the top; the established detailed validation controls remain available below.

### Publish Package hierarchy and primary action

Existing final video, selected thumbnail, publishing metadata, platform-specific copy, captions, performance report, and editable project data are presented as one Publish Package. Thumbnail selection and styling remain secondary and progressive; credit-consuming thumbnail generation remains on the existing CreatorCostGuard path. The existing `handleDownloadCreatorPackage` action is the single dominant conclusion and now distinguishes current, first-export, and needs-update package language without changing the exported files or download behavior.

### Capabilities preserved

- Final-video readiness, reusable-export detection, outdated package detection, export history and signatures.
- Thumbnail selection, generation, refinement, history, design save/revert, and existing credit confirmation.
- Metadata preparation, title/description/hashtag copy, and selected-platform adaptations.
- System checks, creator confirmations, captions, package reporting, project data, and package download.
- Canonical five-step workflow, CreatorCostGuard, persistence, queues/jobs, provider routing, generation logic, credits, APIs, export architecture, and Storyverse.

### Intentionally excluded

UX-P2D-1 adds no direct social publishing, scheduling, platform APIs, new AI generation, export formats, analytics providers, Reports redesign, or Creator Director redesign.

### Dependencies and infrastructure

UX-P2D-1 adds zero dependencies and zero infrastructure.

## UX-P2D-2 — Reports Cohesion

Reports remains a top-level portfolio and project-readiness surface, not a sixth CreatorLab workflow step. Its scope remains saved production state, publishing readiness, continuity, lifecycle history, and estimated credit needs. It does not claim post-publish audience, engagement, retention, or social performance analytics.

The portfolio now prioritizes total, active, current-package, and needs-update counts. Production-ready projects, final-video coverage, and total scenes remain available in a compact secondary disclosure. The project selector uses denser, keyboard-accessible rows with the established blue selected state, search, lifecycle filtering, dates, progress, and project metadata preserved.

The selected report now leads with project identity, lifecycle status, last update, and a primary **Open project in Velto Studio** action. HTML and JSON report downloads remain unchanged as secondary actions. Internal readiness score, stage, publishing readiness, and estimated credits required to complete are primary signals; media readiness, planned duration, continuity, and total/used credit context remain available as supporting detail.

Blockers, warnings, and existing recommended next actions form the primary decision section, while existing strengths are presented as secondary ready signals. Reports diagnoses unresolved work and Studio remains the operational place to resolve it. Credit totals, estimated used, and estimated remaining values retain the existing explanatory disclaimer and are not presented as billed usage or account balance.

UX-P2D-2 changes no report calculation, readiness or lifecycle calculation, credit policy, API, authentication, persistence, download format, CreatorLab workflow, Publish behavior, Storyverse, or Creator Director behavior. It adds zero dependencies and zero infrastructure.

### Remaining P2D work

- UX-P2D-3: Creator Director/Copilot cohesion.
