import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createCreatorVisualCoveragePlan,
  validateCreatorVisualCoveragePlan,
} from "../lib/creator/visualCoverage.ts";

const sceneId = "11111111-1111-4111-8111-111111111111";

const validateFull = (targetDurationSec, beats) => {
  const result = validateCreatorVisualCoveragePlan({
    creatorSceneId: sceneId,
    targetDurationSec,
    beats,
  });
  assert.equal(result.valid, true);
  assert.equal(result.fullyCovered, true);
  assert.equal(result.motionCovered, true);
};

// Explicit image selection must remain image-only even when a completed video
// also exists.
const imageSelected = createCreatorVisualCoveragePlan({
  creatorSceneId: sceneId,
  selectedSource: "image",
  image: "https://assets.test/current.jpg",
  videoUrl: "https://assets.test/current.mp4",
  videoStatus: "done",
  videoDurationSeconds: 30,
  targetDurationSec: 18,
}, {
  editorialCadence: true,
});

assert.deepEqual(
  imageSelected.map((beat) => beat.kind),
  ["image", "image", "image"],
);
assert.deepEqual(
  imageSelected.map((beat) => beat.durationSec),
  [6, 6, 6],
);
assert.ok(
  imageSelected.every(
    (beat) => beat.sourceUrl === "https://assets.test/current.jpg",
  ),
);
validateFull(18, imageSelected);

// Current video is the establishing beat; current image supplies the remaining
// cadence. A 24s scene must not remain one long visual.
const videoAndImage = createCreatorVisualCoveragePlan({
  creatorSceneId: sceneId,
  selectedSource: "video",
  image: "https://assets.test/current.jpg",
  videoUrl: "https://assets.test/current.mp4",
  videoStatus: "done",
  videoDurationSeconds: 10,
  targetDurationSec: 24,
}, {
  editorialCadence: true,
});

assert.deepEqual(
  videoAndImage.map((beat) => beat.kind),
  ["video", "image", "image"],
);
assert.deepEqual(
  videoAndImage.map((beat) => beat.durationSec),
  [8, 8, 8],
);
validateFull(24, videoAndImage);

// A shorter-but-usable selected video remains visible rather than being
// discarded. The remainder is deterministically re-planned.
const shortVideoAndImage = createCreatorVisualCoveragePlan({
  creatorSceneId: sceneId,
  selectedSource: "video",
  image: "https://assets.test/current.jpg",
  videoUrl: "https://assets.test/current.mp4",
  videoStatus: "done",
  videoDurationSeconds: 6,
  targetDurationSec: 24,
}, {
  editorialCadence: true,
});

assert.deepEqual(
  shortVideoAndImage.map((beat) => beat.kind),
  ["video", "image", "image", "image"],
);
assert.deepEqual(
  shortVideoAndImage.map((beat) => beat.durationSec),
  [6, 6, 6, 6],
);
validateFull(24, shortVideoAndImage);

// Image-only scenes receive deterministic motion variation without inventing
// a historical/currentness transition.
const imageOnly = createCreatorVisualCoveragePlan({
  creatorSceneId: sceneId,
  selectedSource: "image",
  image: "https://assets.test/current.jpg",
  targetDurationSec: 18,
  assetHistory: [{
    id: "old-image",
    kind: "image",
    url: "https://assets.test/previous-version.jpg",
  }],
}, {
  editorialCadence: true,
});

assert.deepEqual(
  imageOnly.map((beat) => beat.motionPreset),
  ["slow_push_in", "soft_pan", "cutaway"],
);
assert.equal(
  imageOnly.some(
    (beat) => beat.sourceUrl === "https://assets.test/previous-version.jpg",
  ),
  false,
  "previous versions must never become automatic B-roll",
);
validateFull(18, imageOnly);

// A video-only source can provide multi-beat coverage when the trimmed source
// fully covers the editorial duration.
const videoOnly = createCreatorVisualCoveragePlan({
  creatorSceneId: sceneId,
  selectedSource: "video",
  videoUrl: "https://assets.test/current.mp4",
  videoStatus: "done",
  videoDurationSeconds: 24,
  clipInSec: 2,
  clipOutSec: 20,
  targetDurationSec: 18,
}, {
  editorialCadence: true,
});

assert.deepEqual(
  videoOnly.map((beat) => beat.durationSec),
  [6, 6, 6],
);
assert.deepEqual(
  videoOnly.map((beat) => beat.sourceStartSec),
  [2, 8, 14],
);
validateFull(18, videoOnly);

// Insufficient video-only coverage fails closed and leaves the renderer's
// existing fallback path authoritative.
const insufficientVideoOnly = createCreatorVisualCoveragePlan({
  creatorSceneId: sceneId,
  selectedSource: "video",
  videoUrl: "https://assets.test/current.mp4",
  videoStatus: "done",
  videoDurationSeconds: 10,
  targetDurationSec: 18,
}, {
  editorialCadence: true,
});
assert.deepEqual(insufficientVideoOnly, []);

// Previous-version media alone is not eligible to manufacture coverage.
const historyOnly = createCreatorVisualCoveragePlan({
  creatorSceneId: sceneId,
  selectedSource: "image",
  targetDurationSec: 18,
  assetHistory: [{
    id: "old-image",
    kind: "image",
    url: "https://assets.test/previous-version.jpg",
  }],
}, {
  editorialCadence: true,
});
assert.deepEqual(historyOnly, []);

// Legacy behavior remains available outside the explicit long-form cadence
// contract.
const legacy = createCreatorVisualCoveragePlan({
  creatorSceneId: sceneId,
  image: "https://assets.test/current.jpg",
  targetDurationSec: 18,
  assetHistory: [{
    id: "old-image",
    kind: "image",
    url: "https://assets.test/previous-version.jpg",
  }],
  visualBlockPlan: [
    { purpose: "Primary" },
    { purpose: "Continuation" },
  ],
});
assert.equal(legacy.length, 2);
assert.equal(
  legacy[1].sourceUrl,
  "https://assets.test/previous-version.jpg",
  "legacy callers remain byte-compatible until separately migrated",
);

const exportRoute = fs.readFileSync(
  new URL("../app/api/creator-export/route.ts", import.meta.url),
  "utf8",
);
assert.match(
  exportRoute,
  /selectedSource:\s*scene\.exportSource === "video" \? "video" : "image"/,
);
assert.match(
  exportRoute,
  /const authoritativeCreatorFormat =/,
  "Creator format must be resolved from persisted project authority",
);
assert.match(
  exportRoute,
  /persistedCreatorState\?\.brief\.format === "youtube_video"/,
);
assert.match(
  exportRoute,
  /exportPayload\.creatorFormat = authoritativeCreatorFormat/,
  "renderer must receive the same authoritative Creator format",
);
assert.match(
  exportRoute,
  /editorialCadence:\s*authoritativeCreatorFormat === "youtube_video"/,
  "D2 cadence must never be enabled from client-supplied format alone",
);
assert.doesNotMatch(
  exportRoute,
  /editorialCadence:\s*body\.creatorFormat/,
);

console.log("STAGE_0_20D2_ACTIVE_MEDIA_COVERAGE_BINDING=PASS");
