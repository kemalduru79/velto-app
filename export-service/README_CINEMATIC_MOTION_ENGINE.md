# Static still-image production

CreatorLab still images use fixed framing for their entire assigned duration.
Automatic pan, zoom, drift and motion-preset rotation have been removed. Long
holds of the same still are not subdivided into artificial motion beats.

The direct Creator export, durable final-export worker and native stitching
paths use `src/staticImage.js`. The documentary renderer keeps its existing
16:9 cover fit with a fixed centered crop; other existing fit modes and output
sizes remain supported. Genuine video playback, clip in/out points and audio
processing are retained. Static coverage may extend to cover measured narration;
video-only coverage is never extended beyond its source by reconciliation.

## Existing projects and signed plans

No migration or background rewrite is performed. Existing MP4s, media, scene
records and signatures remain intact. A persisted image beat that requests
`native_zoompan_v1` or a motion preset fails with
`CREATOR_STATIC_IMAGE_PLAN_REQUIRED`. Rebuild the export plan through the normal
CreatorLab flow to obtain static coverage and a new production signature. Do not
rewrite an old signed manifest, reuse its signature for different rendering, or
retry a legacy durable job unchanged.

Client signature planning, direct export and durable server authority all call
`createCreatorVisualCoveragePlan`. Its new image beats use `static_image` with
no motion preset. Historical filler/timeline names such as `animated_still` and
`image_motion_tail` remain readable for compatibility; newly planned reference
image segments explicitly use the `static` preset and render without movement.
These names do not enable an animation path.

Deploying this behavior requires the corrected app and export renderer together.
This change does not restart or deploy either service.

## Local verification

Run `npm run test:creator-static-images`. It uses synthetic FFmpeg fixtures and
actual render-function declarations without starting the HTTP service or loading
its environment. It verifies fixed beginning/middle/end frames, image duration,
audio/video duration alignment, genuine moving-video trim, legacy-plan rejection,
and signature invalidation. No production network request, AI generation, paid
provider, project write or archived-media operation is involved.
