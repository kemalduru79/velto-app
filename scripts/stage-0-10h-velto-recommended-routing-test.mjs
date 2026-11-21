import assert from "node:assert/strict";

import { getOperationCreditCost } from "../lib/credits/operationPolicy.ts";
import {
  executeCreatorRecommendedVisualBatch,
  estimateCreatorRecommendedVisualManifest,
  hasCreatorUsableVisual,
} from "../lib/creator/recommendedVisualExecution.ts";

const decision = (sceneId, selectedTreatment, fallbackTreatments = ["ai_image"]) => ({
  sceneId,
  creatorSceneId: `scene-${sceneId}`,
  qualityTier: "pro",
  selectedTreatment,
  fallbackTreatments,
});

const scenes = [
  { id: 1, image: "https://assets.test/existing.jpg", assetHistory: [{ id: "old", kind: "image", url: "https://assets.test/existing.jpg", createdAt: "2026-01-01T00:00:00.000Z", source: "loaded" }] },
  { id: 2, image: "", assetHistory: [] },
  { id: 3, image: "", assetHistory: [] },
  { id: 4, image: "", assetHistory: [] },
  { id: 5, image: "", assetHistory: [] },
  { id: 6, image: "", assetHistory: [] },
];
const decisions = [
  decision(1, "reuse_existing"),
  decision(2, "stock_photo"),
  decision(3, "stock_video"),
  decision(4, "ai_image"),
  decision(5, "ai_video", ["image_motion"]),
  decision(6, "ai_image"),
];

const calls = { stockPhoto: 0, stockVideo: 0, image: [], video: [], voice: 0, export: 0 };
const result = await executeCreatorRecommendedVisualBatch({
  scenes,
  decisions,
  targetSceneIds: scenes.map((scene) => scene.id),
  qualityMode: "pro",
  acquireStock: async (scene, productionDecision) => {
    if (productionDecision.selectedTreatment === "stock_photo") {
      calls.stockPhoto += 1;
      return { publicUrl: `https://assets.test/stock-${scene.id}.jpg`, mediaType: "photo", durationSeconds: null };
    }
    if (productionDecision.selectedTreatment === "stock_video") {
      calls.stockVideo += 1;
      return { publicUrl: `https://assets.test/stock-${scene.id}.mp4`, mediaType: "video", durationSeconds: 8 };
    }
    return null;
  },
  generateImage: async (scene) => {
    calls.image.push(scene.id);
    if (scene.id === 6) throw new Error("image failed");
    return `https://assets.test/generated-${scene.id}.jpg`;
  },
  generateVideo: async (scene) => {
    calls.video.push(scene.id);
    return { videoUrl: `https://assets.test/generated-${scene.id}.mp4`, videoJobId: `job-${scene.id}`, videoDurationSeconds: 7 };
  },
  createHistoryId: (sceneId, kind) => `stock-${kind}-${sceneId}`,
  now: () => "2026-08-30T00:00:00.000Z",
});

assert.equal(result.outcomes.find((item) => item.sceneId === 1)?.status, "preserved");
assert.equal(result.scenes[0].image, scenes[0].image);
assert.deepEqual(result.scenes[0].assetHistory, scenes[0].assetHistory);
assert.equal(calls.image.includes(1), false, "reused media must trigger no paid image generation");
assert.equal(calls.video.includes(1), false, "reused media must trigger no paid video generation");

assert.equal(calls.stockPhoto, 1);
assert.equal(result.scenes[1].image, "https://assets.test/stock-2.jpg");
assert.equal(result.scenes[1].assetHistory.at(-1).source, "stock");
assert.equal(result.scenes[1].assetHistory.at(-1).kind, "image");
assert.equal(calls.stockVideo, 1);
assert.equal(result.scenes[2].videoUrl, "https://assets.test/stock-3.mp4");
assert.equal(result.scenes[2].videoStatus, "done");
assert.equal(result.scenes[2].assetHistory.at(-1).source, "stock");
assert.equal(result.scenes[2].assetHistory.at(-1).durationSec, 8);
assert.equal(hasCreatorUsableVisual(result.scenes[2]), true);

assert.deepEqual(calls.image, [4, 5, 6], "AI image runs only for its decision, the AI-video prerequisite, and the isolated failing scene");
assert.deepEqual(calls.video, [5], "routed AI video runs exactly for the selected scene");
assert.equal(result.scenes[4].videoStatus, "done");
assert.equal(result.outcomes.find((item) => item.sceneId === 6)?.status, "failed");
assert.equal(result.scenes[1].image, "https://assets.test/stock-2.jpg", "a later failure cannot corrupt a successful stock scene");
assert.equal(calls.voice, 0, "the visual executor has no voice-generation dependency");
assert.equal(calls.export, 0, "the visual executor has no final-render dependency");

const standardCalls = { image: 0, video: 0 };
const standard = await executeCreatorRecommendedVisualBatch({
  scenes: [{ id: 7, image: "", assetHistory: [] }],
  decisions: [decision(7, "ai_video", ["ai_image"])],
  targetSceneIds: [7],
  qualityMode: "standard",
  acquireStock: async () => null,
  generateImage: async () => { standardCalls.image += 1; return "https://assets.test/standard.jpg"; },
  generateVideo: async () => { standardCalls.video += 1; throw new Error("Standard must not dispatch video"); },
});
assert.equal(standardCalls.image, 1);
assert.equal(standardCalls.video, 0, "Standard cannot dispatch paid generative video");
assert.equal(standard.scenes[0].image, "https://assets.test/standard.jpg");

const manifest = estimateCreatorRecommendedVisualManifest({
  scenes,
  decisions,
  targetSceneIds: scenes.map((scene) => scene.id),
  qualityMode: "pro",
});
assert.deepEqual(manifest, { images: 5, videos: 1 });
assert.equal(getOperationCreditCost("creator_image", "pro"), 2);
assert.equal(getOperationCreditCost("creator_video", "pro"), 6);
assert.equal(JSON.stringify(result.outcomes).match(/openai|pexels|runway|veo/gi), null, "creator-facing routing outcomes remain provider-neutral");

console.log("Stage 0.10H Velto Recommended routing tests passed.");
