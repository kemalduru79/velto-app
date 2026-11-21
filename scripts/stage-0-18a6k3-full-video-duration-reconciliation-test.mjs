import assert from "node:assert/strict";
import fs from "node:fs";
import {
  reconcileCreatorFullVideoSourceDurations,
} from "../lib/creator/editorState.ts";
import {
  createCreatorVisualCoveragePlan,
  validateCreatorVisualCoveragePlan,
} from "../lib/creator/visualCoverage.ts";
import {
  reconcileVisualCoveragePlan,
  resolveCoverageBackedSceneTargetDuration,
} from "../export-service/src/visualCoverage.js";
import { buildCreatorFinalProductionSignature } from "../lib/creator/finalProductionSignature.ts";
import { DEFAULT_CREATOR_BACKGROUND_MUSIC } from "../lib/creator/backgroundMusic.ts";

const sceneId = "7228898f-7970-486c-af83-0783842c01cb";
const videoUrl = "https://assets.test/current.mp4";
const fullVideoScene = {
  id: 1,
  creatorSceneId: sceneId,
  videoUrl,
  videoStatus: "done",
  videoDurationSeconds: 10,
  targetDurationSec: 8.32,
};

const reconciled = reconcileCreatorFullVideoSourceDurations({
  scenes: [fullVideoScene],
  observedSources: { [sceneId]: { videoUrl, durationSec: 10.08 } },
});
assert.equal(reconciled.changed, true);
assert.deepEqual(reconciled.reconciledCreatorSceneIds, [sceneId]);
assert.equal(reconciled.scenes[0].videoDurationSeconds, 10.08);
const fullCoverage = createCreatorVisualCoveragePlan(reconciled.scenes[0]);
assert.deepEqual(fullCoverage.map((beat) => [beat.kind, beat.startSec, beat.endSec]), [
  ["video", 0, 8.32],
]);
assert.equal(validateCreatorVisualCoveragePlan({
  creatorSceneId: sceneId,
  targetDurationSec: 8.32,
  beats: fullCoverage,
}).fullyCovered, true);
assert.equal(resolveCoverageBackedSceneTargetDuration({
  timing: { targetSceneDuration: 8.32 },
  visualCoveragePlan: fullCoverage,
}), 8.32, "renderer target must remain the canonical scene window");
assert.equal(reconcileVisualCoveragePlan({
  creatorSceneId: sceneId,
  timing: { targetSceneDuration: 8.32 },
  visualCoveragePlan: fullCoverage,
}, 8.32).length, 1);
const persistedRoundTrip = JSON.parse(JSON.stringify(reconciled.scenes[0]));
assert.deepEqual(createCreatorVisualCoveragePlan(persistedRoundTrip), fullCoverage);
assert.equal(persistedRoundTrip.videoDurationSeconds, 10.08);
assert.equal(persistedRoundTrip.targetDurationSec, 8.32);

const trimmed = reconcileCreatorFullVideoSourceDurations({
  scenes: [{ ...fullVideoScene, clipInSec: 1, clipOutSec: 8.5 }],
  observedSources: { [sceneId]: { videoUrl, durationSec: 10.08 } },
});
assert.equal(trimmed.changed, false);
assert.equal(trimmed.scenes[0].videoDurationSeconds, 10);
assert.deepEqual(createCreatorVisualCoveragePlan(trimmed.scenes[0]).map((beat) => beat.durationSec), [7.5]);

const staleAsset = reconcileCreatorFullVideoSourceDurations({
  scenes: [fullVideoScene],
  observedSources: { [sceneId]: { videoUrl: "https://assets.test/old.mp4", durationSec: 14 } },
});
assert.equal(staleAsset.changed, false);
assert.equal(staleAsset.scenes[0].videoDurationSeconds, 10);

const alreadyExact = reconcileCreatorFullVideoSourceDurations({
  scenes: [reconciled.scenes[0]],
  observedSources: { [sceneId]: { videoUrl, durationSec: 10.08 } },
});
assert.equal(alreadyExact.changed, false);
assert.equal(alreadyExact.scenes[0], reconciled.scenes[0]);

const exactLengthCoverage = createCreatorVisualCoveragePlan({
  ...fullVideoScene,
  videoDurationSeconds: 8.32,
});
assert.equal(exactLengthCoverage.at(-1)?.endSec, 8.32);

const mixedScene = {
  ...fullVideoScene,
  targetDurationSec: 15,
  image: "https://assets.test/tail.jpg",
  visualBlockPlan: [{ purpose: "Full video" }, { purpose: "Motion-backed tail" }],
};
const mixedReconciled = reconcileCreatorFullVideoSourceDurations({
  scenes: [mixedScene],
  observedSources: { [sceneId]: { videoUrl, durationSec: 10.08 } },
}).scenes[0];
const mixedCoverage = createCreatorVisualCoveragePlan(mixedReconciled);
assert.deepEqual(mixedCoverage.map((beat) => beat.kind), ["video", "image"]);
assert.deepEqual(mixedCoverage.map((beat) => beat.durationSec), [10.08, 4.92]);
assert.equal(validateCreatorVisualCoveragePlan({
  creatorSceneId: sceneId,
  targetDurationSec: 15,
  beats: mixedCoverage,
}).fullyCovered, true);

const genuinelyShort = createCreatorVisualCoveragePlan({
  ...fullVideoScene,
  videoDurationSeconds: 5,
  targetDurationSec: 10,
});
assert.equal(validateCreatorVisualCoveragePlan({
  creatorSceneId: sceneId,
  targetDurationSec: 10,
  beats: genuinelyShort,
}).fullyCovered, false, "a genuinely short video must not be stretched");

const explicitTrimCoverage = createCreatorVisualCoveragePlan({
  ...fullVideoScene,
  clipInSec: 1,
  clipOutSec: 6.5,
  image: "https://assets.test/tail.jpg",
  visualBlockPlan: [{ purpose: "Trimmed source" }, { purpose: "Motion continuation" }],
});
assert.deepEqual(explicitTrimCoverage.map((beat) => [beat.kind, beat.durationSec]), [
  ["video", 5.5],
  ["image", 2.82],
]);

const finalSignature = buildCreatorFinalProductionSignature({
  scenes: [{
    ...reconciled.scenes[0],
    exportSource: "video",
    renderMode: "video",
    timing: { targetSceneDuration: 8.32 },
    visualCoveragePlan: fullCoverage,
  }],
  backgroundMusic: DEFAULT_CREATOR_BACKGROUND_MUSIC,
});
assert.match(finalSignature, /"targetSceneDuration":8\.32/);
assert.match(finalSignature, /"endSec":8\.32/);
assert.doesNotMatch(finalSignature, /"clipOutSec":8\.32/);

const pageSource = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
assert.match(pageSource, /observeCreatorVideoSourceDuration/);
assert.match(pageSource, /matchesExpectedCreatorVideoSource/);
assert.match(pageSource, /await persistProject\(false, \{[\s\S]*sourceScenes: exportAuthorityScenes/);
assert.match(pageSource, /sourceScenes: durationReconciliation\.scenes/);

console.log("STAGE_0_18A6K3_FULL_VIDEO_DURATION_RECONCILIATION=PASS");
