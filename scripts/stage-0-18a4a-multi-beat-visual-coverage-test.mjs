import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createCreatorVisualCoveragePlan,
  validateCreatorVisualCoveragePlan,
} from "../lib/creator/visualCoverage.ts";
import { auditFlowContinuityScene } from "../lib/video/flowContinuityAudit.ts";
import { moveCreatorScene, removeCreatorScene } from "../lib/creator/editorState.ts";

const sceneId = "11111111-1111-4111-8111-111111111111";
const assetHistory = [{
  id: "image-history-1",
  kind: "image",
  url: "https://assets.test/alternate.jpg",
  createdAt: "2026-09-27T00:00:00.000Z",
}];
const scene = {
  id: 2,
  creatorSceneId: sceneId,
  narration: "Narration must remain exactly unchanged.",
  image: "https://assets.test/scene-2.jpg",
  videoUrl: "https://assets.test/scene-2.mp4",
  videoStatus: "done",
  videoDurationSeconds: 10,
  targetDurationSec: 20.53,
  assetHistory,
  visualBlockPlan: [
    { durationSec: 10, purpose: "Primary moving beat" },
    { durationSec: 10.53, purpose: "Grounded visual continuation" },
  ],
};
const historyBefore = JSON.stringify(assetHistory);
const coverage = createCreatorVisualCoveragePlan(scene);

assert.equal(coverage.length, 2);
assert.deepEqual(coverage.map((beat) => beat.kind), ["video", "image"]);
assert.deepEqual(coverage.map((beat) => beat.durationSec), [10, 10.53]);
assert.deepEqual(coverage.map((beat) => [beat.startSec, beat.endSec]), [[0, 10], [10, 20.53]]);
assert.equal(coverage[1].renderer, "native_zoompan_v1");
assert.equal(JSON.stringify(assetHistory), historyBefore, "active composition must not mutate asset history");
assert.equal(scene.narration, "Narration must remain exactly unchanged.");

const validation = validateCreatorVisualCoveragePlan({
  creatorSceneId: sceneId,
  targetDurationSec: 20.53,
  beats: coverage,
});
assert.equal(validation.valid, true);
assert.equal(validation.fullyCovered, true);
assert.equal(validation.motionCovered, true);
assert.equal(validation.coveredDurationSec, 20.53);

const audit = auditFlowContinuityScene({
  id: 2,
  source: "video",
  hasNarration: true,
  narrationDurationSec: 19.78,
  targetDurationSec: 20.53,
  videoDurationSec: 10,
  visualCoveragePlan: coverage,
});
assert.equal(audit.durationSource, "coverage_plan");
assert.equal(audit.risks.includes("visual_gap"), false);
assert.equal(audit.risks.includes("freeze_frame_risk"), false);

const incomplete = createCreatorVisualCoveragePlan({ ...scene, image: "", assetHistory: [] });
const incompleteAudit = auditFlowContinuityScene({
  id: 2,
  source: "video",
  targetDurationSec: 20.53,
  videoDurationSec: 10,
  visualCoveragePlan: incomplete,
});
assert.equal(incompleteAudit.risks.includes("visual_gap"), true);

const staticCoverage = createCreatorVisualCoveragePlan(scene, { imageMotionRendererAvailable: false });
const staticAudit = auditFlowContinuityScene({
  id: 2,
  source: "video",
  targetDurationSec: 20.53,
  videoDurationSec: 10,
  visualCoveragePlan: staticCoverage,
  visualBlocks: [{ type: "video_clip", durationSec: 20.53 }],
});
assert.equal(staticAudit.risks.includes("freeze_frame_risk"), true);

const persisted = JSON.parse(JSON.stringify({ ...scene, visualCoveragePlan: coverage }));
assert.deepEqual(persisted.visualCoveragePlan, coverage);
assert.deepEqual(createCreatorVisualCoveragePlan(persisted), coverage);

const secondId = "22222222-2222-4222-8222-222222222222";
const reordered = moveCreatorScene([
  { ...scene, visualCoveragePlan: coverage },
  { ...scene, id: 3, creatorSceneId: secondId, visualCoveragePlan: [] },
], sceneId, "later");
assert.equal(reordered[1].creatorSceneId, sceneId);
assert.equal(reordered[1].visualCoveragePlan[0].creatorSceneId, sceneId);
const removed = removeCreatorScene(reordered, secondId);
assert.equal(removed.scenes.length, 1);
assert.equal(removed.scenes[0].creatorSceneId, sceneId);

const nativeRenderer = fs.readFileSync(new URL("../lib/video/stitching/nativeMedia.server.ts", import.meta.url), "utf8");
const exportResolver = fs.readFileSync(new URL("../lib/creator/exportScenes.ts", import.meta.url), "utf8");
const exportRoute = fs.readFileSync(new URL("../app/api/creator-export/route.ts", import.meta.url), "utf8");
assert.match(nativeRenderer, /createVisualCoverageVideoBase/);
assert.match(nativeRenderer, /createImageMotionVideoBase/);
assert.match(nativeRenderer, /concatVideoSegments\(segmentPaths, beats\.map/);
assert.match(nativeRenderer, /createSceneAudioClip/);
assert.match(exportResolver, /visualCoveragePlan: validCoverage \? coverage : \[\]/);
assert.match(exportRoute, /visualCoveragePlan = createCreatorVisualCoveragePlan/);
const productionExportService = fs.readFileSync(new URL("../export-service/src/server.js", import.meta.url), "utf8");
assert.match(productionExportService, /createVisualCoverageClipWithAudio/);
assert.match(productionExportService, /reconcileVisualCoveragePlan/);
assert.match(productionExportService, /concat=n=\$\{beats\.length\}:v=1:a=0/);
assert.match(productionExportService, /zoompan=z=/);

console.log("STAGE_0_18A4A_MULTI_BEAT_VISUAL_COVERAGE=PASS");
