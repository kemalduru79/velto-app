# CreatorLab static-image production — local validation

Implemented on an isolated worktree from bf309b5fbb2e387653970be43f8c5340cf6ead67.
No active runtime source was edited, no service restarted, and no deployment or
production write was performed. The original Chrome tab was not accessed.

## Behavior

New still coverage is `static_image`, without motion presets. A continuous hold
of one still uses one beat. Both export-service image paths and native stitching
use one fixed-fit filter. Documentary output retains 1280x720 cover/crop with
fixed centered coordinates. Genuine video playback and trim filters remain.
Audio-duration reconciliation accepts/extends static image tails and still
rejects video-only extensions beyond available coverage. Readiness accepts
intentional static coverage without treating it as an accidental video freeze.

Old `native_zoompan_v1` image plans (and static-labelled beats retaining motion
presets) are rejected before rendering, not converted under their old signatures.
The normal planner produces a new static plan and signature. No persisted plans,
media, old export signatures, autosave code or recovery state were rewritten.
Legacy filler/timeline enum names are retained for compatibility only; generated
reference-image filler uses a single static segment.

## Validation

- `npm run test:creator-static-images`: PASS. Four actual renderer-function paths
  rendered synthetic stills: direct image, coverage used by durable jobs, image
  tail after trimmed video, and native stitching. No HTTP server was started.
- Beginning/middle/ending decoded frames: PASS. Maximum mean RGB difference was
  0.003617 on the 0–255 scale; differences were limited to small encoding noise.
  No zoom/pan filter or time-dependent crop remains in either renderer.
- Assigned image/video duration: 3.04 seconds in each still fixture. Render paths
  with narration retained 3.04-second audio streams, zero measured stream drift.
  Synthetic signal onset, ending and silent tail tests passed.
- Genuine moving-video coverage/trim: PASS; motion retained and first output
  frame matched the requested source offset rather than the untrimmed opening.
- Legacy-plan rejection, no mutation, and different production signature: PASS.
- Eleven focused planning/duration/readiness/signature/durable-worker regressions:
  PASS (listed below). Native 16:9 fill regression: PASS for 4:3, 3:2, 16:9 and
  portrait source sizes. Total: 13 test scripts passed.
- TypeScript: `tsc --noEmit --incremental false` PASS.
- ESLint: affected modules and tests PASS with zero errors and ten existing
  unused-variable warnings. Full `app/create/page.tsx` lint did not complete:
  Node exhausted its default heap, then a separate attempt exhausted a 6 GiB
  heap. Full-page lint is therefore UNVERIFIED, not reported as passed.
- `git diff --check`: PASS.

Focused scripts: stage-0-18a4a, stage-0-18a6e, stage-0-20b2, stage-0-20c2,
stage-0-20d1, stage-0-20d2, stage-0-20e1, stage-0-20e2, stage-0-20g,
stage-0-13c-h-final-signature-normalization, stage-2a, stage-2b-worker, and
creator-static-images-test.

## Preserved documentary feasibility

A network-disabled, read-only check of the previously preserved repaired project
after-image built a fresh manifest using the actual new server authority. It
retained 36 scenes and 36 narration references, produced 36 static image beats
plus one genuine video beat, and passed flow readiness with no blockers or manual
confirmation requirement. Its production signature differs from the old export.
All 108 archive manifest checks still pass. Existing image/audio/video assets can
supply a static re-render without AI regeneration. No re-render was initiated.

This is offline feasibility evidence, not a live storage/authentication/export
acceptance run. Original canonical script, research and approval authority remain
unavailable as declared by the earlier recovery; this change restores none of
those. Future re-rendering requires separate authorization, coordinated activation
of the app and renderer, a fresh plan/signature, and normal live readiness checks.
The historical MP4 must remain preserved.

## Exact changed files

- `app/api/creator-export/route.ts`
- `app/create/page.tsx`
- `docs/CREATORLAB_STATIC_IMAGES_2026-10-30.md`
- `export-service/README_CINEMATIC_MOTION_ENGINE.md`
- `export-service/src/server.js`
- `export-service/src/staticImage.js`
- `export-service/src/visualCoverage.js`
- `lib/creator/controlledLongFormAcceptance.ts`
- `lib/creator/programEditorialPolish.ts`
- `lib/creator/publishReadiness.server.ts`
- `lib/creator/visualCoverage.ts`
- `lib/video/flowContinuityAudit.ts`
- `lib/video/stitching/nativeMedia.server.ts`
- `lib/video/timelineSync.ts`
- `lib/video/visualFiller.ts`
- `package.json`
- `scripts/creator-static-images-test.mjs`
- `scripts/stage-0-18a4a-multi-beat-visual-coverage-test.mjs`
- `scripts/stage-0-18a6e-final-export-visual-coverage-duration-test.mjs`
- `scripts/stage-0-20b2-measured-audio-duration-authority-test.mjs`
- `scripts/stage-0-20c2-native-16x9-render-fill-test.mjs`
- `scripts/stage-0-20d2-active-media-coverage-binding-test.mjs`
- `scripts/stage-0-20e1-program-visual-rhythm-test.mjs`
- `scripts/stage-0-20g-controlled-long-form-acceptance-test.mjs`
- `scripts/stage-2a-durable-creator-final-export-test.mjs`
