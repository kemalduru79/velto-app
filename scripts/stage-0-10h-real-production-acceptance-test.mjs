import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  advanceCreatorDispatchCountdown,
  createCreatorDispatchCountdown,
  freezeCreatorSceneScope,
} from "../lib/creator/preDispatchPolicy.ts";
import { creatorStageAfterSuccess } from "../lib/creator/stageNavigation.ts";
import { createStockAssetMetadata } from "../lib/providers/stock/sourceMetadata.ts";
import { applyCreatorVisualSourceOverride } from "../lib/creator/visualSourceMethod.ts";
import { executeCreatorRecommendedVisualBatch, estimateCreatorRecommendedVisualManifest } from "../lib/creator/recommendedVisualExecution.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/create/page.tsx");
const safeFetch = read("lib/security/safeRemoteMediaFetch.ts");

const stockCandidate = (mediaType) => ({
  sourceType: "stock", mediaType, provider: "pexels", providerMediaId: mediaType === "photo" ? "10" : "20",
  sourcePageUrl: `https://www.pexels.com/${mediaType}/20`, creatorName: "Creator", creatorProfileUrl: "https://www.pexels.com/@creator",
  license: { id: "pexels-license", url: "https://www.pexels.com/license/", snapshotDate: "2026-08-22" },
  width: 1920, height: 1080, orientation: "landscape", durationSeconds: mediaType === "video" ? 12 : null,
  previewUrl: "https://example.test/preview", renditions: [], averageColor: null,
  attributionText: `${mediaType} by Creator`, metadataVersion: "test",
});
for (const mediaType of ["photo", "video"]) {
  const metadata = createStockAssetMetadata({ candidate: stockCandidate(mediaType), renditionId: "production", renditionWidth: 1920, renditionHeight: 1080, bytes: 100, projectId: "project", reuseIdentity: "reuse", importedAt: "2026-08-30T00:00:00.000Z" });
  assert.equal(metadata.source, "stock");
  assert.equal(metadata.providerMediaId, mediaType === "photo" ? "10" : "20");
  assert.equal(metadata.licenseId, "pexels-license");
  assert.equal(metadata.attributionText, `${mediaType} by Creator`);
  assert.equal(metadata.durationSeconds, mediaType === "video" ? 12 : null);
}
assert.match(safeFetch, /Prefer a verified public IPv4/);

const frozen = freezeCreatorSceneScope([4, 9, 4, 99], [1, 4, 9, 12]);
assert.deepEqual(frozen, [4, 9]);
assert.equal(Object.isFrozen(frozen), true);
let countdown = createCreatorDispatchCountdown(frozen, 3);
let dispatches = 0;
for (let index = 0; index < 2; index += 1) {
  const tick = advanceCreatorDispatchCountdown(countdown);
  countdown = tick.state;
  if (tick.dispatch) dispatches += 1;
}
assert.equal(dispatches, 0, "provider dispatch must not occur before zero");
const finalTick = advanceCreatorDispatchCountdown(countdown);
if (finalTick.dispatch) dispatches += 1;
assert.equal(dispatches, 1);
assert.deepEqual(finalTick.state.sceneIds, [4, 9]);
const cancelled = createCreatorDispatchCountdown([4, 9], 7);
assert.equal(cancelled.secondsRemaining, 7);
assert.equal(dispatches, 1, "cancelling without advancing cannot dispatch");

assert.equal(creatorStageAfterSuccess(1, "brief_completed"), 2);
assert.equal(creatorStageAfterSuccess(2, "strategy_approved"), 3);
assert.equal(creatorStageAfterSuccess(3, "production_setup_continued"), 4);
assert.equal(creatorStageAfterSuccess(3, "brief_completed"), 3, "older/failing work cannot move the stage backward");

const baseDecision = (sceneId, selectedTreatment) => ({
  sceneId, creatorSceneId: `scene-${sceneId}`, qualityTier: "pro", selectedTreatment,
  fallbackTreatments: ["ai_image"], signals: { sceneRole: "exposition", contentNature: "real_world", motionImportance: .7, visualImportance: .8, continuityImportance: .2, stockSuitability: .8, customGenerationNeed: .2, authenticityValue: .8, stockSearchQuery: `scene ${sceneId}` },
  scores: {}, confidence: .9, reasonCodes: [], explanation: "", stockIntent: null,
  videoIntent: selectedTreatment === "ai_video" ? { visualImportance: .8, motionImportance: .8, continuityImportance: .2, sceneRole: "exposition", recommendedSeconds: 7, qualityIntent: "professional", referenceAvailabilityCount: 0, fallbackTreatment: "ai_image", productionPriority: .8 } : null,
  overrideState: "automatic", expectedPaidGeneration: true, expectedCreditOperation: selectedTreatment === "ai_video" ? "video" : "image", providerCostCategory: "known_estimate",
});
const allScenes = [{ id: 1 }, { id: 4, visualSourceMethod: "ai_image" }, { id: 9, visualSourceMethod: "ai_video", image: "existing-prerequisite" }, { id: 12 }];
const decisions = allScenes.map((scene) => applyCreatorVisualSourceOverride({ scene, decision: baseDecision(scene.id, "stock_photo"), qualityMode: "pro" }).decision);
const manifest = estimateCreatorRecommendedVisualManifest({ scenes: allScenes, decisions, targetSceneIds: frozen, qualityMode: "pro", shouldPreserveExisting: () => false, allowFallback: () => false });
assert.deepEqual(manifest, { images: 1, videos: 1 });
const calls = { image: [], video: [], stock: [] };
const execution = await executeCreatorRecommendedVisualBatch({
  scenes: allScenes, decisions, targetSceneIds: frozen, qualityMode: "pro",
  allowFallback: () => false, shouldPreserveExisting: () => false,
  acquireStock: async (scene) => { calls.stock.push(scene.id); return null; },
  generateImage: async (scene) => { calls.image.push(scene.id); return `image-${scene.id}`; },
  generateVideo: async (scene) => { calls.video.push(scene.id); return { videoUrl: `video-${scene.id}`, videoJobId: "job", videoDurationSeconds: 7 }; },
});
assert.deepEqual(calls, { image: [4], video: [9], stock: [] });
assert.equal(execution.outcomes.length, 2);
assert.equal(execution.scenes.find((scene) => scene.id === 1).image, undefined);
assert.equal(execution.scenes.find((scene) => scene.id === 12).image, undefined);

assert.doesNotMatch(page, /<CreatorCostGuard/);
assert.match(page, /setSceneScriptFitFeedback/);
assert.match(page, /Split recommended/);
assert.match(page, /Apply duration/);
assert.match(page, /setCreatorSelectedWorkspaceStep\(\(current\) => creatorStageAfterSuccess\(current, "brief_completed"\)\)/);
assert.match(page, /setCreatorSelectedWorkspaceStep\(\(current\) => creatorStageAfterSuccess\(current, "strategy_approved"\)\)/);

console.log("Stage 0.10H real-production acceptance tests passed.");
