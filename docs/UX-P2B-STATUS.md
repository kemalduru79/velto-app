# UX-P2B — Brief & Strategy Experience

## Purpose

Make Brief → Strategy feel like one guided creator decision flow rather than a long configuration form, while preserving advanced CreatorLab capabilities.

## Pass 1 scope

- Keep the primary Brief outcome-led and visually calm.
- Preserve essential output decisions and keep provider/engine complexity internal.
- Keep Idea Lab / multi-topic mode as an advanced planning capability through progressive disclosure.
- Reduce the visual weight of optional/secondary planning surfaces.
- Make Strategy recommendation the dominant decision surface.
- Keep alternative directions available without giving them equal visual priority by default.
- Treat YouTube intelligence as optional supporting evidence rather than a mandatory workflow step.
- Keep Strategy approval discoverable while the user reviews the decision canvas.
- Preserve responsive behavior and reduced-motion support.

## Capability guardrails

The following behavior must remain unchanged:

- Brief validation through `createSetup`.
- Idea Lab generation through `handleBulkGenerateIdeas`.
- Idea Lab selection through `toggleBulkSelection`.
- Selected multi-topic generation through `handleGenerateSelectedBulk`.
- Existing Strategy recommendation and direction-selection state.
- Production package creation through `handleCreatorProductionPackage`.
- Generation, credits, persistence, provider routing and API contracts.
- Storyverse UI and behavior.

## Implementation approach

This pass is deliberately isolated in `app/creatorlab-ux-p2b.css`. It builds on the validated UX-P2A foundation and avoids a high-risk rewrite of the large CreatorLab page.

No new dependency, database, SaaS service, Azure resource or paid design system is introduced.

## Acceptance gate

Run locally:

```bash
node scripts/ux-p2a-experience-foundation-smoke-test.mjs
node scripts/ux-p2b-brief-strategy-smoke-test.mjs
npm run build
```

Then manually verify:

- Brief remains clear at first glance.
- Idea Lab is collapsed/secondary by default but fully usable when opened.
- Multi-topic generation and selection still work.
- Strategy recommendation is visually dominant.
- Alternative directions remain selectable.
- YouTube intelligence reads as optional evidence.
- Strategy approval remains visible without obscuring content.
- Desktop, tablet and mobile layouts remain usable.
- Storyverse has no visual regression.

## Out of scope

- Production workspace redesign (UX-P2C)
- Publish / Reports / Director cohesion (UX-P2D)
- API/provider changes
- Credit-model changes
- Persistence changes
- Infrastructure changes
