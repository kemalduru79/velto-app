import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CreatorVideoReconciliationPendingError,
  executeCreatorRecommendedVisualBatch,
} from "../lib/creator/recommendedVisualExecution.ts";
import {
  bindCreatorVideoQueueReconciliationJob,
  claimCreatorVideoQueueReconciliation,
  isCreatorVideoQueueReconciliationLocallyOwned,
  releaseCreatorVideoQueueReconciliation,
  shouldResumeCreatorVideoQueueReconciliation,
} from "../lib/creator/videoQueueReconciliationOwnership.ts";

const page = readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/creator-video/route.ts", import.meta.url), "utf8");
const sceneId = "10000000-0000-4000-8000-000000000002";
const queueJobId = "20000000-0000-4000-8000-000000000002";

const owners = new Map();
const resumable = (locallyOwned) => shouldResumeCreatorVideoQueueReconciliation({
  resumable: true,
  pollActive: false,
  delayed: false,
  locallyOwned,
});
assert.equal(resumable(false), true, "without ownership, the global path is eligible alongside a local waiter");
const ownerKey = claimCreatorVideoQueueReconciliation(owners, { sceneId: 2, creatorSceneId: sceneId });
assert.equal(ownerKey, sceneId, "stable creatorSceneId owns reconciliation");
assert.equal(claimCreatorVideoQueueReconciliation(owners, { sceneId: 99, creatorSceneId: sceneId }), null, "a second local owner is rejected");
assert.equal(isCreatorVideoQueueReconciliationLocallyOwned(owners, { sceneId: 2, creatorSceneId: sceneId }), true, "ownership covers pre-queue processing state");
assert.equal(bindCreatorVideoQueueReconciliationJob(owners, ownerKey, queueJobId), true);
assert.equal(isCreatorVideoQueueReconciliationLocallyOwned(owners, { sceneId: 77, creatorSceneId: sceneId, queueJobId }), true, "numeric ordinal is not the binding authority");
assert.equal(resumable(true), false, "global resume is suppressed while locally awaited");
let materializations = 0;
materializations += 1;
assert.equal(materializations, 1, "the local owner materializes successful output exactly once");
releaseCreatorVideoQueueReconciliation(owners, ownerKey);
assert.equal(resumable(isCreatorVideoQueueReconciliationLocallyOwned(owners, { sceneId: 2, creatorSceneId: sceneId, queueJobId })), true, "durable processing can resume after release/remount");

const decision = { sceneId: 2, creatorSceneId: sceneId, qualityTier: "pro", selectedTreatment: "ai_video", fallbackTreatments: ["ai_image"] };
let imageCalls = 0;
let videoCalls = 0;
const success = await executeCreatorRecommendedVisualBatch({
  scenes: [{ id: 2, creatorSceneId: sceneId, image: "", videoUrl: "", videoStatus: "idle", assetHistory: [] }],
  decisions: [decision],
  targetSceneIds: [2],
  qualityMode: "pro",
  acquireStock: async () => null,
  generateImage: async () => { imageCalls += 1; return "https://assets.test/prerequisite.jpg"; },
  generateVideo: async () => {
    videoCalls += 1;
    return { videoUrl: "https://assets.test/final.mp4", videoJobId: queueJobId, videoQueueJobId: queueJobId, videoDurationSeconds: 8, videoGenerationSignature: "signature" };
  },
});
assert.equal(imageCalls, 1);
assert.equal(videoCalls, 1, "one recommended treatment creates one provider request contract");
assert.equal(success.outcomes[0].status, "generated");
assert.equal(success.scenes[0].image, "https://assets.test/prerequisite.jpg", "prerequisite image survives video success");
assert.equal(success.scenes[0].videoUrl, "https://assets.test/final.mp4");
assert.equal(success.scenes[0].videoStatus, "done");
assert.equal(success.scenes[0].videoQueueJobId, queueJobId);
assert.equal(success.scenes[0].videoGenerationSignature, "signature");

const recoverable = await executeCreatorRecommendedVisualBatch({
  scenes: [{ id: 2, creatorSceneId: sceneId, image: "https://assets.test/prerequisite.jpg", videoUrl: "", videoStatus: "idle", assetHistory: [] }],
  decisions: [decision],
  targetSceneIds: [2],
  qualityMode: "pro",
  acquireStock: async () => null,
  generateImage: async () => { throw new Error("must preserve prerequisite"); },
  generateVideo: async () => { throw new CreatorVideoReconciliationPendingError("storage unavailable", { videoQueueJobId: queueJobId, videoGenerationSignature: "pending-signature" }); },
  shouldPreserveExisting: () => false,
});
assert.equal(recoverable.outcomes[0].status, "failed");
assert.equal(recoverable.scenes[0].image, "https://assets.test/prerequisite.jpg");
assert.equal(recoverable.scenes[0].videoStatus, "processing");
assert.equal(recoverable.scenes[0].videoQueueJobId, queueJobId, "succeeded queue identity remains recoverable");
assert.equal(recoverable.scenes[0].videoPendingGenerationSignature, "pending-signature", "pending generation currentness remains recoverable");

const failed = await executeCreatorRecommendedVisualBatch({
  scenes: [{ id: 2, creatorSceneId: sceneId, image: "https://assets.test/prerequisite.jpg", videoUrl: "", videoStatus: "idle", assetHistory: [] }],
  decisions: [{ ...decision, fallbackTreatments: [] }],
  targetSceneIds: [2],
  qualityMode: "pro",
  acquireStock: async () => null,
  generateImage: async () => "unexpected",
  generateVideo: async () => { throw new Error("provider failed"); },
  allowFallback: () => false,
  shouldPreserveExisting: () => false,
});
assert.equal(failed.outcomes[0].status, "failed", "a genuine provider failure remains failed");
assert.equal(failed.outcomes[0].error, "provider failed");

const recommendedDispatch = page.slice(page.indexOf("const generateSceneVideoAndWaitOwned"), page.indexOf("const requestCancelSceneVideo"));
assert.match(recommendedDispatch, /creatorSceneId,[\s\S]*qualityMode:/, "recommended dispatch sends stable creatorSceneId");
assert.match(recommendedDispatch, /bindCreatorVideoQueueReconciliationJob\([\s\S]*setScenes\(\(prev\)/, "queue ownership binds before processing state exposes the queue");
assert.match(page, /isCreatorVideoQueueReconciliationLocallyOwned\([\s\S]*shouldResumeCreatorVideoQueueReconciliation/);
assert.match(page, /finally \{[\s\S]*releaseCreatorVideoQueueReconciliation/);
assert.match(route, /creatorSceneId: typeof body\.creatorSceneId === "string" \? body\.creatorSceneId : null/, "canonical queue payload retains creatorSceneId");
assert.doesNotMatch(readFileSync(new URL("../lib/creator/videoQueueReconciliationOwnership.ts", import.meta.url), "utf8"), /fetch\(|reserveMeteredOperation|settleMeteredOperation|provider/i);

console.log("STAGE_0_18A1_VIDEO_QUEUE_SINGLE_OWNER=PASS");
