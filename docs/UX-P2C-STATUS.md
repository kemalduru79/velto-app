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
