# UX-P2C Status

## UX-P2C-1 — Production Workspace Foundation

### What changed

- Reframed CreatorLab Production as one compact workspace headed by the approved project title and existing plan metadata.
- Refined Setup and Create & Review into a lightweight, accessible phase navigator with active, complete, and available semantics.
- Reworked the Create & Review setup recap into a persistent Production Plan summary with clearer title, premise, decision metadata, and a secondary Edit Setup action.
- Added a concise Create & Review production status using existing scene, visual, and voice readiness counts.
- Unified the existing primary production action, Scene Production Navigator, scene workspace, and Creator Editor under the UX-P2A/P2B semantic surface language.
- Added responsive and reduced-motion treatment for the production workspace foundation.

### Intentionally preserved

- The `setup` and `create_review` substeps and their existing `onChange` behavior.
- The existing Setup continuation, scene preparation, production continuation, media generation, review, editor, and export handlers.
- The PROD-UX-P1 Scene Production Navigator, including active/ready/pending states and 3-step scene completion.
- Creator Editor text editing, trimming, media history, refresh, continuity warnings, timeline, and scene operations.
- Creator Background Music behavior and confirmation requirements.
- CreatorCostGuard as the authoritative confirmation before credit-consuming operations.
- API contracts, generation logic, provider routing, credit calculations, persistence, queue/job behavior, and Storyverse.

### Remaining for P2C-2 / P2C-3

- Deeper Creator Editor and timeline information architecture and interaction polish.
- Later production-detail refinement beyond the foundation hierarchy introduced here.
- Publish, Reports, and Creator Director remain outside this pass.

### Dependencies and infrastructure

UX-P2C-1 adds zero new dependencies and zero new infrastructure.

## UX-P2C-2 — Scene Production Operational UX

### Scene triage model

UX-P2C-2 adds a deterministic, frontend-only attention model derived from existing in-memory scene state:

- **Generating:** an existing image, narration, dialogue, batch, dispatch-countdown, or queued video operation is active.
- **Review:** generation failed, media is stale, continuity reports a warning, or the current script health needs review.
- **Ready:** script, visual, voice, and any required motion output are ready.
- **Needs action:** one or more required scene assets are still missing without an active generation or review condition.

The model is non-persisted, non-authoritative, and never changes generation behavior.

### Navigator and selected-scene focus

- The existing Scene Production area now begins with a compact operational overview showing real ready, needs-action, generating, and review counts.
- Compact scene rows expose scene identity, overall status, three-step readiness, generating/attention state, and a clear focused selection.
- Only the focused scene renders its detailed operational controls, reducing scanning noise for projects with many scenes.
- Existing bulk selection remains separate and unchanged for controlled multi-scene actions.
- The PROD-UX-P1 Script, Visual, and Audio navigator remains the focused scene's operational spine.

### Primary action and attention treatment

- The focused scene presents one dominant next-action entry that routes to the relevant existing Script, Visual, or Audio control.
- Supporting and advanced controls remain in their existing panels and retain their handlers.
- Active generation disables the competing dominant action and shows an explicit generating state without fake percentages or timers.
- Missing, failed, and review conditions are summarized once beside the selected scene action.
- Credit-consuming paths use provider-neutral wording and remain protected by CreatorCostGuard; no independent credit calculation was added.

### Behavior explicitly preserved

- Setup/Create & Review navigation and Production Plan behavior.
- Scene bulk selection, render-mode controls, batch generation, individual generation, polling, queues, cancellation, and history.
- The existing Scene Production Navigator and its active/ready/pending three-step behavior.
- Creator Editor, timeline, trimming, text editing, media regeneration, continuity warnings, and scene operations.
- Creator Background Music and CreatorCostGuard confirmation behavior.
- API contracts, generation algorithms, provider routing, credit pricing, persistence, export architecture, and Storyverse.

### Remaining for UX-P2C-3

- Deeper Creator Editor and timeline layout, navigation, and editing interaction refinement.
- Advanced editor progressive disclosure beyond the scene-production focus introduced here.

UX-P2C-2 adds zero new dependencies and zero new infrastructure.

## UX-P2C-3 — Creator Editor + Timeline UX

### Editor information architecture

- Reframed the embedded editor as **Edit & Assemble**, identified by the selected scene number and concise scene title.
- Established a desktop preview-and-inspector layout with Media Preview as the primary surface, Scene Inspector as the focused control column, and Timeline as the bottom sequence view.
- Consolidated current video, voice, and continuity attention into restrained status surfaces close to the relevant action.
- Grouped Scene Text, Narration, and Dialogue under one Content section with explicit dirty-state feedback and one dominant Save action only when changes exist.
- Grouped trim and duration controls under an open Media & Timing disclosure so stale/trim attention remains easy to reach.
- Moved media history, restore, movement, duplication, addition, deletion, and Undo into quiet native advanced disclosures without removing any operation.

### Timeline improvements

- Timeline items now show stable scene order, concise title, existing image thumbnail when present, media type, and reliable existing trim or target duration.
- The selected timeline scene has an unmistakable blue selected state while retaining the existing stable `creatorSceneId` selection mechanism.
- Selecting a scene keeps it visible within the horizontal timeline using reduced-motion-aware `scrollIntoView` with nearest block/inline alignment.
- No drag/drop, waveform, generated thumbnail, frame editing, or new duration calculation was introduced.

### Production focus and Editor selection

When the Editor opens, `creatorFocusedSceneId` is mapped once to the same scene's existing `creatorSceneId` and assigned to `selectedCreatorEditorSceneId`. After opening, Editor timeline selection remains authoritative inside the Editor. Bulk scene selection is never read or changed by this synchronization, and no third scene-selection source was added.

### Technical information and progressive disclosure

- The existing media fingerprint calculation remains available as a hidden diagnostic marker, but `media:<fingerprint>` is no longer visible in normal CreatorLab UX.
- Provider names, signatures, hashes, model details, and routing terminology are absent from the Editor presentation.
- Media history and scene operations use native `<details>` disclosures; important stale-video refresh and continuity actions remain directly visible.

### Capabilities preserved

- Native video/image preview and trim playback boundaries.
- Explicit text Save semantics and existing voice/video staleness behavior.
- Narration, dialogue, continuity warnings, Refresh Video, trim, media restore, scene movement, duplication, deletion, addition, Undo, and timeline selection.
- Stable scene identity, editor-state normalization, API contracts, generation, credits, persistence, queues/jobs, export behavior, provider routing, and Storyverse.

### Responsive and accessibility work

- Desktop retains side-by-side preview and inspector; mobile stacks preview, inspector, and timeline without viewport overflow.
- Timeline remains horizontally scrollable with practical touch targets.
- Editor mount focus now uses `preventScroll`, timeline selection is keyboard accessible, and automatic timeline movement respects reduced-motion preferences.

### P2C-4 outlook

P2C-3 completes the planned Editor and Timeline information architecture. A P2C-4 pass, if scheduled, should be limited to final visual QA and usability polish rather than new workflow or generation capability.

UX-P2C-3 adds zero new dependencies and zero new infrastructure.

## UX-P2C-5 — Unified Five-Step Project Workflow

CreatorLab now presents one canonical Project Workflow:

1. Brief
2. Strategy
3. Production Setup
4. Create & Review
5. Publish

The nested Setup/Create & Review navigator was removed from the Production canvas so the left Project Workflow is the single navigation source of truth. The existing internal four-stage workspace and `creatorProductionSubstep` state remain authoritative: visible Production Setup maps to internal Production plus `setup`, while visible Create & Review maps to internal Production plus `create_review`. Publish remains the existing internal Publish workspace and is now visibly numbered Step 5.

All availability and completion presentation is derived from existing brief, approved-strategy/production-package, production-complete, and publish-complete state. The existing Production and Publish gates remain authoritative; no visit-based completion flags or persisted workflow state were added. The global header retains the legitimate lifecycle readiness percentage while its compact phase label now reflects the active five-step workflow item.

This information-architecture correction does not change API contracts, persistence, generation, provider routing, credits, queues/jobs, export behavior, or Storyverse. It adds zero dependencies and zero infrastructure.

## UX-P2C Final Cleanup — Ready for Closure

- Normal CreatorLab autosave success is now a compact, low-emphasis Saved status; the existing error alert remains prominent for exceptional persistence failures.
- Scene Production is the single scene-section identity, with the existing scene, readiness, and triage counts directly beneath it. Redundant Scene Workspace, Scenes, and Operational Overview labels were removed.
- The existing Editor-open handler now appears as a contextual secondary Open Editor action in the Scene Production heading instead of an isolated button.
- The accepted five-step Project Workflow remains unchanged, as do scene triage, focused-scene behavior, batch selection, Creator Editor synchronization, and timeline behavior.
- No API, persistence timing, generation, credit, provider-routing, queue/job, export, dependency, infrastructure, or Storyverse behavior changed.

UX-P2C is ready for closure after final validation.
