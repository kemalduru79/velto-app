import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isCreatorSceneVisualActionBlocked,
  isCreatorSceneVisualCountdown,
  isCreatorSceneVisualGenerating,
} from "../lib/creator/visualGenerationStatus.ts";
import { executeCreatorRecommendedVisualBatch } from "../lib/creator/recommendedVisualExecution.ts";

const page = readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const statusInput = {
  phase: "processing",
  admittedSceneIds: [3],
  processingSceneIds: [3],
};

assert.equal(isCreatorSceneVisualGenerating({ sceneId: 3, ...statusInput }), true);
assert.equal(isCreatorSceneVisualGenerating({ sceneId: 5, ...statusInput }), false);
assert.equal(isCreatorSceneVisualActionBlocked({ sceneId: 5, countdownSceneIds: [], ...statusInput }), false);
assert.equal(isCreatorSceneVisualCountdown({ sceneId: 5, countdownSceneIds: [3] }), false);
assert.equal(isCreatorSceneVisualCountdown({ sceneId: 5, countdownSceneIds: [3, 5] }), true);
assert.equal(isCreatorSceneVisualGenerating({
  sceneId: 5,
  phase: "processing",
  admittedSceneIds: [5],
  processingSceneIds: [5],
}), true);

const decisions = [3, 5].map((sceneId) => ({
  sceneId,
  creatorSceneId: `scene-${sceneId}`,
  qualityTier: "pro",
  selectedTreatment: "ai_image",
  fallbackTreatments: [],
  signals: {},
  scores: {},
  confidence: 1,
  reasonCodes: [],
  explanation: "",
  stockIntent: null,
  videoIntent: null,
  overrideState: "explicit",
  expectedPaidGeneration: true,
  expectedCreditOperation: "image",
  providerCostCategory: "known_estimate",
}));
const dispatchedSceneIds = [];
await executeCreatorRecommendedVisualBatch({
  scenes: [{ id: 3 }, { id: 5 }],
  decisions,
  targetSceneIds: [3],
  qualityMode: "pro",
  acquireStock: async () => null,
  generateImage: async (scene) => {
    dispatchedSceneIds.push(scene.id);
    return `image-${scene.id}`;
  },
  generateVideo: async () => { throw new Error("unexpected video dispatch"); },
  shouldPreserveExisting: () => false,
  allowFallback: () => false,
});
assert.deepEqual(dispatchedSceneIds, [3]);

await executeCreatorRecommendedVisualBatch({
  scenes: [{ id: 3 }, { id: 5 }],
  decisions,
  targetSceneIds: [5],
  qualityMode: "pro",
  acquireStock: async () => null,
  generateImage: async (scene) => {
    dispatchedSceneIds.push(scene.id);
    return `image-${scene.id}`;
  },
  generateVideo: async () => { throw new Error("unexpected video dispatch"); },
  shouldPreserveExisting: () => false,
  allowFallback: () => false,
});
assert.deepEqual(dispatchedSceneIds, [3, 5]);

assert.match(page, /const sceneVisualGenerating = isCreatorSceneVisualGenerating\(\{/);
assert.match(page, /const sceneVisualActionBlocked = isCreatorSceneVisualActionBlocked\(\{/);
assert.match(page, /startCreatorSceneVisualCountdown\(\{/);
assert.match(page, /setActiveVisualGenerationSceneIds\(\(current\) => Object\.freeze\(Array\.from/);
assert.match(page, /current\.filter\(\(sceneId\) => !scopedTargetSceneIds\.includes\(sceneId\)\)/);
assert.match(page, /: sceneVisualGenerating\s*\? uiLanguage === "en" \? "Generating…"/);
assert.doesNotMatch(page, /\{isBatchRendering \|\| redrawLoadingId === scene\.id\s*\? uiLanguage === "en" \? "Generating…"/);
assert.doesNotMatch(page, /scene\.videoStatus === "delayed" \|\|\s*isBatchRendering \|\|\s*creatorMediaPreflightLoading/);

console.log("Stage 0.10H scene visual CTA/status test passed.");
