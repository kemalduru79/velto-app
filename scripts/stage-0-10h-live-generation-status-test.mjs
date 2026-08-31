import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getCreatorGeneratingSceneIds,
  isCreatorSceneVisualGenerating,
} from "../lib/creator/visualGenerationStatus.ts";
import { executeCreatorRecommendedVisualBatch } from "../lib/creator/recommendedVisualExecution.ts";
import {
  assertCreatorVisualExecutionScope,
  CreatorVisualGenerationScopeError,
  resolveCreatorVisualGenerationScope,
} from "../lib/creator/visualGenerationScope.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/create/page.tsx");
const sceneIds = Array.from({ length: 30 }, (_, index) => index + 1);

const single = resolveCreatorVisualGenerationScope({ mode: "single", requestedSceneIds: [3], availableSceneIds: sceneIds });
assert.deepEqual(getCreatorGeneratingSceneIds({ phase: "countdown", admittedSceneIds: single.sceneIds, processingSceneIds: [] }), []);
assert.deepEqual(getCreatorGeneratingSceneIds({ phase: "processing", admittedSceneIds: single.sceneIds, processingSceneIds: [3] }), [3]);
for (const sceneId of sceneIds) {
  assert.equal(
    isCreatorSceneVisualGenerating({ sceneId, phase: "processing", admittedSceneIds: single.sceneIds, processingSceneIds: [3] }),
    sceneId === 3,
  );
}
assert.deepEqual(getCreatorGeneratingSceneIds({ phase: "idle", admittedSceneIds: [], processingSceneIds: [] }), []);
assert.deepEqual(getCreatorGeneratingSceneIds({ phase: "processing", admittedSceneIds: [3], processingSceneIds: [] }), [], "completed scene leaves Generating");
assert.throws(() => assertCreatorVisualExecutionScope({ admission: single, executionSceneIds: [3, 4] }), CreatorVisualGenerationScopeError);

const selected = resolveCreatorVisualGenerationScope({ mode: "selected", requestedSceneIds: [3, 5], availableSceneIds: sceneIds });
assert.deepEqual(getCreatorGeneratingSceneIds({ phase: "processing", admittedSceneIds: selected.sceneIds, processingSceneIds: [3, 5] }), [3, 5]);
assert.deepEqual(getCreatorGeneratingSceneIds({ phase: "processing", admittedSceneIds: selected.sceneIds, processingSceneIds: [5] }), [5]);

const project = resolveCreatorVisualGenerationScope({ mode: "project", requestedSceneIds: [2, 4, 8], availableSceneIds: sceneIds });
assert.deepEqual(getCreatorGeneratingSceneIds({ phase: "processing", admittedSceneIds: project.sceneIds, processingSceneIds: [2, 4, 8] }), [2, 4, 8]);

const decisions = sceneIds.map((sceneId) => ({
  sceneId, creatorSceneId: `scene-${sceneId}`, qualityTier: "pro", selectedTreatment: "ai_image",
  fallbackTreatments: [], signals: {}, scores: {}, confidence: 1, reasonCodes: [], explanation: "",
  stockIntent: null, videoIntent: null, overrideState: "explicit", expectedPaidGeneration: true,
  expectedCreditOperation: "image", providerCostCategory: "known_estimate",
}));
const calls = [];
await executeCreatorRecommendedVisualBatch({
  scenes: sceneIds.map((id) => ({ id })), decisions, targetSceneIds: single.sceneIds, qualityMode: "pro",
  acquireStock: async () => null,
  generateImage: async (scene) => { calls.push(scene.id); return `image-${scene.id}`; },
  generateVideo: async () => { throw new Error("unexpected video"); },
  shouldPreserveExisting: () => false, allowFallback: () => false,
});
assert.deepEqual(calls, [3]);

assert.match(page, /data-admitted-visual-scene-ids=\{activeVisualGenerationSceneIds\.join/);
assert.match(page, /data-generating-visual-scene-ids=\{creatorGeneratingVisualSceneIds\.join/);
assert.match(page, /isCreatorSceneVisualGenerating\(\{/);
assert.match(page, /setActiveVisualGenerationSceneIds\(\(current\) => Object\.freeze\(Array\.from/);
assert.match(page, /current\.filter\(\(sceneId\) => !scopedTargetSceneIds\.includes\(sceneId\)\)/);
assert.doesNotMatch(page, /isBatchRendering && creatorSelectedSceneIdSet\.has/);
assert.doesNotMatch(page, /imageDispatchCountdown\?\.scope === "scene" && imageDispatchCountdown\.sceneId === scene\.id/);
assert.doesNotMatch(page, /videoDispatchCountdown\?\.scope === "scene" && videoDispatchCountdown\.sceneId === scene\.id/);

console.log("Stage 0.10H live generation status/scope tests passed.");
