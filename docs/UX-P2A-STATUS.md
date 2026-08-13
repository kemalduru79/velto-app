# UX-P2A — Creator Experience Foundation

## Scope

- Unify CreatorLab shell, surface hierarchy and navigation styling under one semantic visual system.
- Preserve all existing CreatorLab business logic, generation flows, credits, persistence and routing.
- Preserve Storyverse behavior and styling.
- Improve outcome selection and Production Setup / Create & Review navigation without changing handlers.
- Add focus-visible and reduced-motion behavior for the new CreatorLab foundation layer.
- Keep implementation isolated and rollback-friendly; no new paid dependency or infrastructure.

## Files introduced

- `app/creatorlab-ux-p2a.css`
- `app/creatorlab-ux-p2a-compat.css`
- `scripts/ux-p2a-experience-foundation-smoke-test.mjs`

## Existing files intentionally touched

- `app/layout.tsx`
- `components/experience/CreatorLabShell.tsx`
- `components/create/CreatorOutcomeStart.tsx`
- `components/create/CreatorProductionSubnav.tsx`

## Acceptance gate

Run:

```bash
node scripts/ux-p2a-experience-foundation-smoke-test.mjs
npm run build
```

Then manually verify CreatorLab desktop, tablet and mobile layouts, keyboard focus states, outcome selection, Production sub-navigation, top navigation, and Storyverse regression.

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
