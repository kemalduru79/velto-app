import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  advanceCreatorDispatchCountdown,
  createCreatorDispatchCountdown,
  freezeCreatorSceneScope,
  getCreatorDispatchUiPhase,
} from "../lib/creator/preDispatchPolicy.ts";
import { executeCreatorRecommendedVisualBatch } from "../lib/creator/recommendedVisualExecution.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/create/page.tsx");

function finishCountdown(sceneIds, seconds, onDispatch) {
  let state = createCreatorDispatchCountdown(sceneIds, seconds);
  assert.equal(getCreatorDispatchUiPhase(state, false), "countdown");
  assert.equal(getCreatorDispatchUiPhase(state, true), "countdown", "countdown must take UI priority over generating state");
  for (let elapsed = 0; elapsed < seconds - 1; elapsed += 1) {
    const tick = advanceCreatorDispatchCountdown(state);
    state = tick.state;
    assert.equal(tick.dispatch, false);
    assert.equal(onDispatch.count, 0, "provider dispatch must remain zero before countdown reaches zero");
  }
  const finalTick = advanceCreatorDispatchCountdown(state);
  if (finalTick.dispatch) onDispatch.count += 1;
  assert.equal(onDispatch.count, 1);
  assert.equal(getCreatorDispatchUiPhase(null, true), "generating");
}

finishCountdown([3], 5, { count: 0 });
finishCountdown([3, 5, 7], 7, { count: 0 });
const cancelledDispatch = { count: 0 };
const cancelled = createCreatorDispatchCountdown([3, 5, 7], 7);
assert.equal(cancelled.secondsRemaining, 7);
assert.equal(cancelledDispatch.count, 0, "cancelling without advancing causes zero dispatch");

const frozen = freezeCreatorSceneScope([3, 5, 7], [1, 3, 5, 7, 9]);
const changedSelection = [3, 5, 7, 9];
assert.deepEqual(frozen, [3, 5, 7]);
assert.notDeepEqual(frozen, changedSelection, "selection changes cannot expand a frozen countdown scope");

const decision = (sceneId) => ({
  sceneId, creatorSceneId: `scene-${sceneId}`, qualityTier: "pro", selectedTreatment: "ai_video",
  fallbackTreatments: ["ai_image"], signals: {}, scores: {}, confidence: 1, reasonCodes: [], explanation: "",
  stockIntent: null, videoIntent: {}, overrideState: "explicit", expectedPaidGeneration: true,
  expectedCreditOperation: "video", providerCostCategory: "known_estimate",
});
const calls = { image: 0, video: 0, order: [] };
const existingImageScenes = [{ id: 3, image: "existing-image" }];
await executeCreatorRecommendedVisualBatch({
  scenes: existingImageScenes, decisions: [decision(3)], targetSceneIds: [3], qualityMode: "pro",
  shouldPreserveExisting: () => false, allowFallback: () => false, acquireStock: async () => null,
  generateImage: async () => { calls.image += 1; calls.order.push("image"); return "generated-image"; },
  generateVideo: async () => { calls.video += 1; calls.order.push("video"); return { videoUrl: "video", videoJobId: "job", videoDurationSeconds: 7 }; },
});
assert.equal(calls.image, 0, "existing image must be reused for AI Video");
assert.equal(calls.video, 1);

calls.image = 0; calls.video = 0; calls.order = [];
await executeCreatorRecommendedVisualBatch({
  scenes: [{ id: 5 }], decisions: [decision(5)], targetSceneIds: [5], qualityMode: "pro",
  shouldPreserveExisting: () => false, allowFallback: () => false, acquireStock: async () => null,
  generateImage: async () => { calls.image += 1; calls.order.push("image"); return "generated-image"; },
  generateVideo: async () => { calls.video += 1; calls.order.push("video"); return { videoUrl: "video", videoJobId: "job", videoDurationSeconds: 7 }; },
});
assert.deepEqual(calls.order, ["image", "video"], "missing prerequisite image must finish before video dispatch");

const toolbarStart = page.indexOf('data-creator-selected-scenes-toolbar="true"');
const navigatorStart = page.indexOf("<CreatorSceneProductionStatus", toolbarStart);
assert.ok(toolbarStart >= 0 && toolbarStart < navigatorStart, "selected toolbar must render above the complete scene navigator");
const toolbar = page.slice(toolbarStart, navigatorStart);
assert.match(toolbar, /creatorSelectedSceneIds\.length/);
assert.match(toolbar, /Generate Visuals/);
assert.match(toolbar, /Clear selection/);
assert.doesNotMatch(toolbar, /Output mode|Estimated credits|Cost Guard|Pexels|OpenAI|Runway/);
assert.match(toolbar, /creatorSelectedVisualSourceMethod === "stock"/);
assert.match(page, /creatorVisualDispatchCountdown\.secondsRemaining/);
assert.match(page, /videoDispatchCountdown \? cancelPendingVideoDispatch : cancelPendingImageDispatch/);
assert.match(page, /mode: "selected",\s*sceneIds: selectedScenes\.map\(\(scene\) => scene\.id\)/);
assert.match(page, /mediaKind === "video"\s*\? SINGLE_VIDEO_DISPATCH_COUNTDOWN_SECONDS\s*: SINGLE_IMAGE_DISPATCH_COUNTDOWN_SECONDS/);
assert.match(page, /seconds: BATCH_VIDEO_DISPATCH_COUNTDOWN_SECONDS/);
assert.match(page, /seconds: BATCH_IMAGE_DISPATCH_COUNTDOWN_SECONDS/);

console.log("Stage 0.10H countdown and selected-scenes bulk UX tests passed.");
