# UX-P2A — Creator Experience Foundation

## Scope

- Unify CreatorLab shell, surface hierarchy and navigation styling under one semantic visual system.
- Preserve all existing CreatorLab business logic, generation flows, credits, persistence and routing.
- Preserve Storyverse behavior and styling.
- Improve outcome selection and Production Setup / Create & Review navigation without changing handlers.
- Add focus-visible and reduced-motion behavior for the new CreatorLab foundation layer.
- Keep implementation isolated and rollback-friendly; no new paid dependency or infrastructure.

## Pass 2 — Workspace polish

- Reduce top-bar visual density while preserving Products, Reports, Projects, language, account and new-project access.
- Clarify the top-bar Studio action as `New project / Yeni proje`; preserve its existing new-project confirmation handler.
- Remove the duplicate visual `Draft stage` badge from the Brief heading; workflow state remains visible through the active Brief step and project progress.
- Reduce duplicated lifecycle status signals in the top bar and keep project progress as the compact status indicator.
- Increase inactive workflow-step legibility without making locked future steps look active.
- Promote the existing Brief validation action into a persistent action dock so the next primary action is visible without scrolling.
- Reuse the existing `createSetup` handler, loading state and input validation. No new transition or generation logic is introduced.

## Files introduced

- `app/creatorlab-ux-p2a.css`
- `app/creatorlab-ux-p2a-compat.css`
- `scripts/ux-p2a-experience-foundation-smoke-test.mjs`

## Existing files intentionally touched

- `app/layout.tsx`
- `components/experience/CreatorLabShell.tsx`
- `components/create/CreatorOutcomeStart.tsx`
- `components/create/CreatorProductionSubnav.tsx`
- `components/navigation/ProductTopNavigation.tsx`

## Acceptance gate

Run:

```bash
node scripts/ux-p2a-experience-foundation-smoke-test.mjs
npm run build
```

Then manually verify:

- CreatorLab desktop, tablet and mobile layouts.
- Top-bar density and New project semantics.
- One clear Brief-stage signal rather than duplicate Draft labels.
- Persistent Brief primary action does not overlap Velto Copilot.
- Primary action remains disabled until a topic/idea is entered and still invokes the existing Brief analysis flow.
- Keyboard focus states and reduced-motion behavior.
- Outcome selection and Production sub-navigation.
- Inactive workflow-step readability.
- Storyverse regression.

## Out of scope for UX-P2A

- API or provider changes
- Credit model changes
- Persistence changes
- Azure or infrastructure work
- CreatorLab feature removal
- Storyverse redesign
- Full Brief / Strategy redesign (UX-P2B)
- Full Production workspace redesign (UX-P2C)
- Publish / Reports / Director cohesion pass (UX-P2D)
