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

## UX-P2D-3 — Velto Copilot Cohesion

Velto Copilot remains a contextual creative co-director inside Velto Studio: it uses current project, selected-scene, readiness, publishing, and reporting context to answer, advise, and preview a safe next action. It remains a non-modal floating panel rather than a workflow step, support widget, or duplicate status dashboard.

Copilot now receives the explicit five-step user-facing workflow: Brief, Strategy, Production Setup, Create & Review, and Publish. The existing internal four-stage `creatorWorkspaceStep` remains authoritative for project state and non-navigation action gating. Structured navigation accepts visible Steps 1–5 and maps them through the existing client navigation helper: Step 3 selects the Production Setup substep, Step 4 selects Create & Review, and Step 5 opens the internal Publish stage. No additional persistent state machine was introduced.

The panel hierarchy is Velto Copilot identity and current context, compact Creative Director/Studio Help modes, conversation, contextual prompts/follow-ups, and composer. Empty-state prompts distinguish Production Setup from Create & Review and align Publish guidance with ready, needs-attention, package-update, and export concepts supplied by existing context. Reporting readiness, strengths, warnings, and next actions are reused without duplicate calculations.

Structured actions remain previews with before/after changes and explicit Apply or Cancel controls. Paid media and release actions retain the existing second confirmation path, existing paid-action classification, existing handlers, and existing readiness validation. Copilot never auto-runs generation or export.

The launcher retains its VS identity with a restrained neutral/blue treatment and moves clear of the desktop Publish action bar. Conversation, history storage, multilingual responses, follow-ups, action approval, and focus/keyboard behavior remain intact. UX-P2D-3 changes no provider/model choice, token limit, authentication, API endpoint, credit calculation, generation routing, queue/job, persistence, Publish, Reports, Storyverse, or infrastructure.

### Remaining P2D work

No dedicated UX-P2D-4 implementation is currently required. A final cross-surface polish pass should only be opened if integrated visual QA identifies a concrete inconsistency or regression.
