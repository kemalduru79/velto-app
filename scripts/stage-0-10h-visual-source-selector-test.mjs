import assert from "node:assert/strict";
import {
  applyCreatorVisualSourceOverride,
  isCreatorVisualSourceMethodExecutable,
  normalizeCreatorVisualSourceMethod,
  persistedCreatorVisualSourceMethod,
  resolveCreatorVisualSourceBatch,
} from "../lib/creator/visualSourceMethod.ts";
import {
  executeCreatorRecommendedVisualBatch,
  estimateCreatorRecommendedVisualManifest,
  hasCreatorUsableVisual,
} from "../lib/creator/recommendedVisualExecution.ts";

const decision = (sceneId, treatment = "ai_image") => ({
  sceneId,
  creatorSceneId: `scene-${sceneId}`,
  qualityTier: "pro",
  selectedTreatment: treatment,
  fallbackTreatments: ["stock_photo", "ai_image"],
  signals: {
    sceneRole: "exposition",
    contentNature: "real_world",
    motionImportance: 0.5,
    visualImportance: 0.8,
    continuityImportance: 0.2,
    stockSuitability: 0.9,
    customGenerationNeed: 0.2,
    authenticityValue: 0.8,
    stockSearchQuery: `safe scene ${sceneId}`,
  },
  scores: Object.fromEntries([
    "reuse_existing", "stock_photo", "stock_video", "ai_image", "image_motion",
    "ai_video", "source_clip", "source_image", "data_visual", "quote_card", "source_card",
  ].map((key) => [key, key === treatment ? 1 : 0.2])),
  confidence: 0.9,
  reasonCodes: ["TEST"],
  explanation: "test",
  stockIntent: treatment.startsWith("stock") ? {
    query: `safe scene ${sceneId}`,
    mediaType: treatment === "stock_video" ? "video" : "photo",
    orientation: "landscape",
    minimumWidth: 1280,
    minimumHeight: 720,
    minimumDurationSeconds: treatment === "stock_video" ? 5 : null,
  } : null,
  videoIntent: treatment === "ai_video" ? {
    visualImportance: 0.8,
    motionImportance: 0.8,
    continuityImportance: 0.2,
    sceneRole: "exposition",
    recommendedSeconds: 7,
    qualityIntent: "professional",
    referenceAvailabilityCount: 0,
    fallbackTreatment: "ai_image",
    productionPriority: 0.8,
  } : null,
  overrideState: "automatic",
  expectedPaidGeneration: treatment.startsWith("ai_") || treatment === "image_motion",
  expectedCreditOperation: treatment === "ai_video" ? "video" : treatment.startsWith("ai_") ? "image" : "none",
  providerCostCategory: treatment.startsWith("stock") ? "not_billable" : "known_estimate",
});

async function execute({ scene, method, qualityMode = "pro", stockAsset = null }) {
  const canonicalDecision = decision(scene.id, "ai_video");
  const override = applyCreatorVisualSourceOverride({
    scene: { ...scene, visualSourceMethod: method },
    decision: canonicalDecision,
    qualityMode,
  });
  const calls = { stock: 0, image: 0, video: 0 };
  const result = await executeCreatorRecommendedVisualBatch({
    scenes: [{ ...scene, visualSourceMethod: method }],
    decisions: [override.decision],
    targetSceneIds: [scene.id],
    qualityMode,
    allowFallback: () => method === "recommended",
    shouldPreserveExisting: () => override.preserveExisting,
    acquireStock: async () => { calls.stock += 1; return stockAsset; },
    generateImage: async () => { calls.image += 1; return `image-${scene.id}`; },
    generateVideo: async () => {
      calls.video += 1;
      return { videoUrl: `video-${scene.id}`, videoJobId: `job-${scene.id}`, videoDurationSeconds: 7 };
    },
    createHistoryId: (sceneId, kind) => `${kind}-${sceneId}`,
    now: () => "2026-08-30T00:00:00.000Z",
  });
  return { ...result, calls, override };
}

assert.equal(normalizeCreatorVisualSourceMethod(undefined), "recommended");
assert.equal(normalizeCreatorVisualSourceMethod("invalid"), "recommended");
assert.equal(persistedCreatorVisualSourceMethod("recommended"), undefined);
assert.equal(persistedCreatorVisualSourceMethod("stock"), "stock");
assert.equal(isCreatorVisualSourceMethodExecutable("upload"), false);
assert.equal(isCreatorVisualSourceMethodExecutable("ai_image"), true);

const recommended = await execute({ scene: { id: 1 }, method: "recommended" });
assert.equal(recommended.override.decision.selectedTreatment, "ai_video");
assert.equal(recommended.calls.video, 1, "no override must retain Production Intelligence");

const preserved = await execute({
  scene: { id: 2, image: "existing", assetHistory: [{ id: "old", kind: "image", url: "old", createdAt: "now", source: "loaded" }] },
  method: "recommended",
});
assert.equal(preserved.calls.image + preserved.calls.video + preserved.calls.stock, 0);
assert.equal(preserved.scenes[0].image, "existing");
assert.equal(preserved.scenes[0].assetHistory.length, 1);

const stockPhoto = await execute({
  scene: { id: 3, image: "current", assetHistory: [{ id: "old", kind: "image", url: "old", createdAt: "now", source: "loaded" }] },
  method: "stock",
  stockAsset: { publicUrl: "stock-photo", mediaType: "photo", durationSeconds: null },
});
assert.deepEqual(stockPhoto.calls, { stock: 1, image: 0, video: 0 });
assert.equal(stockPhoto.scenes[0].image, "stock-photo");
assert.deepEqual(stockPhoto.scenes[0].assetHistory.map((item) => item.source), ["loaded", "stock"]);

const stockVideo = await execute({
  scene: { id: 4, renderMode: "video", assetHistory: [] },
  method: "stock",
  stockAsset: { publicUrl: "stock-video", mediaType: "video", durationSeconds: 12 },
});
assert.deepEqual(stockVideo.calls, { stock: 1, image: 0, video: 0 });
assert.equal(stockVideo.scenes[0].videoUrl, "stock-video");
assert.equal(stockVideo.scenes[0].videoStatus, "done");
assert.equal(stockVideo.scenes[0].assetHistory[0].durationSec, 12);

const stockFailure = await execute({ scene: { id: 5 }, method: "stock" });
assert.deepEqual(stockFailure.calls, { stock: 1, image: 0, video: 0 });
assert.equal(stockFailure.outcomes[0].status, "failed");

const image = await execute({ scene: { id: 6, image: "keep-until-action" }, method: "ai_image" });
assert.deepEqual(image.calls, { stock: 0, image: 1, video: 0 });
assert.equal(image.scenes[0].image, "image-6");

const standardVideo = await execute({ scene: { id: 7 }, method: "ai_video", qualityMode: "standard" });
assert.deepEqual(standardVideo.calls, { stock: 0, image: 0, video: 0 });
assert.equal(standardVideo.outcomes[0].status, "failed");

for (const qualityMode of ["pro", "cinematic"]) {
  const video = await execute({ scene: { id: qualityMode === "pro" ? 8 : 9 }, method: "ai_video", qualityMode });
  assert.deepEqual(video.calls, { stock: 0, image: 1, video: 1 });
  assert.equal(video.scenes[0].videoStatus, "done");
}

const selectionOnlyScene = { id: 10, image: "unchanged", assetHistory: [{ id: "history", kind: "image", url: "history", createdAt: "now", source: "restored" }] };
const selectedMethodScene = { ...selectionOnlyScene, visualSourceMethod: "ai_image" };
assert.equal(selectedMethodScene.image, "unchanged");
assert.deepEqual(selectedMethodScene.assetHistory, selectionOnlyScene.assetHistory);
assert.equal(hasCreatorUsableVisual(selectedMethodScene), true);

const batch = resolveCreatorVisualSourceBatch({
  scenes: [
    { id: 11 },
    { id: 12, visualSourceMethod: "stock" },
    { id: 13, visualSourceMethod: "ai_image" },
    { id: 14, visualSourceMethod: "ai_video" },
  ],
  decisions: [decision(11, "stock_photo"), decision(12, "ai_video"), decision(13, "stock_photo"), decision(14, "stock_photo")],
  targetSceneIds: [11, 12, 13, 14],
  qualityMode: "pro",
});
assert.deepEqual(batch.map((item) => item.decision.selectedTreatment), ["stock_photo", "stock_photo", "ai_image", "ai_video"]);
assert.equal(batch[0].decision.fallbackTreatments.length > 0, true);
assert.deepEqual(batch.slice(1).map((item) => item.decision.fallbackTreatments), [[], [], []]);
assert.equal(batch[1].decision.expectedCreditOperation, "none");
assert.equal(batch[2].decision.expectedCreditOperation, "image");
assert.equal(batch[3].decision.expectedCreditOperation, "video");
assert.deepEqual(estimateCreatorRecommendedVisualManifest({
  scenes: [{ id: 12, visualSourceMethod: "stock" }],
  decisions: [batch[1].decision],
  targetSceneIds: [12],
  qualityMode: "pro",
  shouldPreserveExisting: () => false,
  allowFallback: () => false,
}), { images: 0, videos: 0 });

const reset = { ...selectedMethodScene, visualSourceMethod: persistedCreatorVisualSourceMethod("recommended") };
assert.equal(normalizeCreatorVisualSourceMethod(reset.visualSourceMethod), "recommended");

console.log("Stage 0.10H Visual Source Selector tests passed.");
