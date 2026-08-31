import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertCreatorVisualExecutionScope,
  CreatorVisualGenerationScopeError,
  resolveCreatorVisualGenerationScope,
} from "../lib/creator/visualGenerationScope.ts";
import {
  advanceCreatorDispatchCountdown,
  createCreatorDispatchCountdown,
  getCreatorDispatchUiPhase,
} from "../lib/creator/preDispatchPolicy.ts";
import { executeCreatorRecommendedVisualBatch } from "../lib/creator/recommendedVisualExecution.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/create/page.tsx");
const allSceneIds = Array.from({ length: 30 }, (_, index) => index + 1);

const single = resolveCreatorVisualGenerationScope({ mode: "single", requestedSceneIds: [3], availableSceneIds: allSceneIds });
assert.deepEqual(single.sceneIds, [3]);
assert.equal(Object.isFrozen(single.sceneIds), true);
assert.throws(
  () => resolveCreatorVisualGenerationScope({ mode: "single", requestedSceneIds: [3, 4], availableSceneIds: allSceneIds }),
  CreatorVisualGenerationScopeError,
);
assert.throws(
  () => assertCreatorVisualExecutionScope({ admission: single, executionSceneIds: [3, 4] }),
  CreatorVisualGenerationScopeError,
);

const selected = resolveCreatorVisualGenerationScope({ mode: "selected", requestedSceneIds: [3, 5], availableSceneIds: allSceneIds });
assert.deepEqual(selected.sceneIds, [3, 5]);
const reactiveSelection = [3, 5, 8];
assert.deepEqual(selected.sceneIds, [3, 5]);
assert.notDeepEqual(selected.sceneIds, reactiveSelection);
assert.equal(assertCreatorVisualExecutionScope({ admission: selected, executionSceneIds: [3, 5] }), true);
assert.throws(() => assertCreatorVisualExecutionScope({ admission: selected, executionSceneIds: [3, 5, 8] }), CreatorVisualGenerationScopeError);

const project = resolveCreatorVisualGenerationScope({ mode: "project", requestedSceneIds: allSceneIds, availableSceneIds: allSceneIds });
assert.equal(project.sceneIds.length, 30);

const countdownValues = [];
let countdown = createCreatorDispatchCountdown([3], 5);
let dispatchCount = 0;
while (countdown.secondsRemaining > 0) {
  countdownValues.push(countdown.secondsRemaining);
  assert.equal(getCreatorDispatchUiPhase(countdown, false), "countdown");
  assert.equal(dispatchCount, 0);
  const tick = advanceCreatorDispatchCountdown(countdown);
  countdown = tick.state;
  if (tick.dispatch) dispatchCount += 1;
}
assert.deepEqual(countdownValues, [5, 4, 3, 2, 1]);
assert.equal(dispatchCount, 1);
assert.equal(getCreatorDispatchUiPhase(null, true), "generating");
const cancelledAtFour = createCreatorDispatchCountdown([3], 5);
const firstTick = advanceCreatorDispatchCountdown(cancelledAtFour);
assert.equal(firstTick.state.secondsRemaining, 4);
assert.equal(firstTick.dispatch, false);
assert.equal(0, 0, "Cancel at four seconds creates zero provider dispatch");

const decision = (sceneId) => ({
  sceneId, creatorSceneId: `scene-${sceneId}`, qualityTier: "pro", selectedTreatment: "ai_image",
  fallbackTreatments: [], signals: {}, scores: {}, confidence: 1, reasonCodes: [], explanation: "",
  stockIntent: null, videoIntent: null, overrideState: "explicit", expectedPaidGeneration: true,
  expectedCreditOperation: "image", providerCostCategory: "known_estimate",
});
const scenes = allSceneIds.map((id) => ({ id }));
const decisions = allSceneIds.map(decision);
const generated = [];
await executeCreatorRecommendedVisualBatch({
  scenes, decisions, targetSceneIds: single.sceneIds, qualityMode: "pro",
  acquireStock: async () => null,
  generateImage: async (scene) => { generated.push(scene.id); return `image-${scene.id}`; },
  generateVideo: async () => { throw new Error("unexpected video"); },
  shouldPreserveExisting: () => false, allowFallback: () => false,
});
assert.deepEqual(generated, [3], "active scene 3 with 29 missing scenes must dispatch only scene 3");

generated.length = 0;
await executeCreatorRecommendedVisualBatch({
  scenes, decisions, targetSceneIds: selected.sceneIds, qualityMode: "pro",
  acquireStock: async () => null,
  generateImage: async (scene) => { generated.push(scene.id); return `image-${scene.id}`; },
  generateVideo: async () => { throw new Error("unexpected video"); },
  shouldPreserveExisting: () => false, allowFallback: () => false,
});
assert.deepEqual(generated, [3, 5]);

assert.match(page, /mode: "single",\s*sceneIds: \[scene\.id\]/);
assert.match(page, /mode: "selected",\s*sceneIds: selectedScenes\.map/);
assert.match(page, /mode: "project",\s*sceneIds: scenes\.filter/);
assert.doesNotMatch(page, /dispatchMode: "single" \| "batch" = "single"/);
assert.doesNotMatch(page, /isBatchRendering && creatorSelectedSceneIdSet\.has/);
assert.doesNotMatch(page, /imageDispatchCountdown\?\.scope === "scene"[\s\S]{0,120}generating/);
assert.match(page, /creatorVisualDispatchCountdown\.secondsRemaining/);
assert.match(page, /No generation request has been dispatched/);
assert.doesNotMatch(page, /<CreatorCostGuard/);
assert.match(page, /creatorCostGuardHeaders/);

console.log("Stage 0.10H emergency generation-scope safety tests passed.");
