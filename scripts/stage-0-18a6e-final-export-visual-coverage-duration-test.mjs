import assert from "node:assert/strict";
import fs from "node:fs";
import {
  reconcileVisualCoveragePlan,
  validateVisualCoveragePlan,
} from "../export-service/src/visualCoverage.js";

const creatorSceneId = "11111111-1111-4111-8111-111111111111";
const imageBeat = (startSec, endSec) => ({
  id: `${creatorSceneId}.coverage.1`,
  creatorSceneId,
  startSec,
  endSec,
  durationSec: endSec - startSec,
  kind: "image",
  sourceUrl: "https://assets.test/current.jpg",
  sourceType: "scene_image",
  motionPreset: "slow_push_in",
  renderer: "native_zoompan_v1",
});

const shortImageScene = { creatorSceneId, visualCoveragePlan: [imageBeat(0, 7.5)] };
assert.equal(validateVisualCoveragePlan(shortImageScene, 8).length, 0, "unreconciled persisted coverage must expose the real renderer mismatch");
const minimumReconciled = reconcileVisualCoveragePlan(shortImageScene, 8);
assert.deepEqual(minimumReconciled.map(({ startSec, endSec, durationSec, renderer }) => ({ startSec, endSec, durationSec, renderer })), [{
  startSec: 0,
  endSec: 8,
  durationSec: 8,
  renderer: "native_zoompan_v1",
}]);

const audioExtended = reconcileVisualCoveragePlan({
  creatorSceneId,
  visualCoveragePlan: [imageBeat(0, 8)],
}, 9.25);
assert.equal(audioExtended.at(-1).endSec, 9.25, "audio plus tail may extend renderer-backed image motion");
assert.equal(audioExtended.at(-1).durationSec, 9.25);

const mixedReference = {
  creatorSceneId,
  visualCoveragePlan: [{
    id: `${creatorSceneId}.coverage.1`, creatorSceneId, startSec: 0, endSec: 10, durationSec: 10,
    kind: "video", sourceUrl: "https://assets.test/current.mp4", sourceType: "generated_video", renderer: "native_video",
  }, {
    ...imageBeat(10, 20.53), id: `${creatorSceneId}.coverage.2`, sourceType: "asset_history",
  }],
};
assert.deepEqual(reconcileVisualCoveragePlan(mixedReference, 20.53), mixedReference.visualCoveragePlan, "A4A composition remains unchanged when targets agree");

const trimmedMixed = {
  creatorSceneId,
  visualCoveragePlan: [{
    id: `${creatorSceneId}.coverage.1`, creatorSceneId, startSec: 0, endSec: 6, durationSec: 6,
    kind: "video", sourceUrl: "https://assets.test/current.mp4", sourceStartSec: 2,
    sourceType: "generated_video", renderer: "native_video",
  }, {
    ...imageBeat(6, 7.5), id: `${creatorSceneId}.coverage.2`, sourceType: "asset_history",
  }],
};
const trimmedReconciled = reconcileVisualCoveragePlan(trimmedMixed, 8);
assert.equal(trimmedReconciled[0].sourceStartSec, 2, "trim authority must remain unchanged");
assert.deepEqual(trimmedReconciled.map(({ startSec, endSec }) => [startSec, endSec]), [[0, 6], [6, 8]]);

const videoOnly = { creatorSceneId, visualCoveragePlan: [mixedReference.visualCoveragePlan[0]] };
assert.deepEqual(reconcileVisualCoveragePlan(videoOnly, 12), [], "video-only runtime extension must fail closed");

const invalidGap = {
  creatorSceneId,
  visualCoveragePlan: [imageBeat(0, 4), { ...imageBeat(5, 7.5), id: `${creatorSceneId}.coverage.2` }],
};
assert.deepEqual(reconcileVisualCoveragePlan(invalidGap, 8), [], "non-contiguous input must remain invalid");
assert.deepEqual(reconcileVisualCoveragePlan(mixedReference, 18), [], "shorter runtime targets must not truncate canonical composition");

const service = fs.readFileSync(new URL("../export-service/src/server.js", import.meta.url), "utf8");
assert.match(service, /const beats = reconcileVisualCoveragePlan\(scene, targetDuration\)/);
const reconciliation = fs.readFileSync(new URL("../export-service/src/visualCoverage.js", import.meta.url), "utf8");
assert.doesNotMatch(reconciliation, /freeze.*frame/i);

console.log("STAGE_0_18A6E_FINAL_EXPORT_VISUAL_COVERAGE_DURATION=PASS");
