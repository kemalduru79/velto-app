import assert from "node:assert/strict";
import {
  buildCreatorVideoGenerationSignature,
  deriveCreatorVideoCurrentness,
} from "../lib/creator/videoGeneration.ts";
import { deriveCreatorSceneReviewReasons } from "../lib/creator/sceneReviewReasons.ts";
import { auditFlowContinuityScene } from "../lib/video/flowContinuityAudit.ts";
import { normalizeVideoClipDuration } from "../lib/video/videoDurationPolicy.ts";

const base = {
  text: "A memory shifts as it is recalled.",
  motionHint: "Subtle forward drift",
  cameraDirection: "Slow push in",
  emotion: "Reflective",
  imageUrl: "https://assets.test/scene-2.jpg",
  qualityMode: "pro",
  creatorFormat: "long_form",
  duration: 27.4,
};
const storedSignature = buildCreatorVideoGenerationSignature(base);
const currentSignature = buildCreatorVideoGenerationSignature({ ...base, duration: 20.53 });

assert.equal(normalizeVideoClipDuration(27.4, "pro").durationSec, 10);
assert.equal(normalizeVideoClipDuration(20.53, "pro").durationSec, 10);
assert.equal(deriveCreatorVideoCurrentness({
  videoUrl: "https://assets.test/scene-2.mp4",
  videoStatus: "done",
  generationSignature: storedSignature,
  currentSignature,
}), "current", "equal provider-effective durations must remain current");

const stateFor = (changes = {}, stored = base) => deriveCreatorVideoCurrentness({
  videoUrl: "https://assets.test/scene-2.mp4",
  videoStatus: "done",
  generationSignature: buildCreatorVideoGenerationSignature(stored),
  currentSignature: buildCreatorVideoGenerationSignature({ ...base, ...changes }),
});

assert.equal(stateFor({ duration: 24 }, { ...base, duration: 18 }), "current");
assert.equal(normalizeVideoClipDuration(4.5, "pro").durationSec, 5);
assert.equal(stateFor({ duration: 20.53 }, { ...base, duration: 4.5 }), "stale");
assert.equal(stateFor({ imageUrl: "https://assets.test/changed.jpg" }), "stale");
assert.equal(stateFor({ text: "The prompt changed." }), "stale");
assert.equal(stateFor({ motionHint: "Orbit quickly" }), "stale");
assert.equal(stateFor({ cameraDirection: "Wide locked frame" }), "stale");
assert.equal(stateFor({ emotion: "Urgent" }), "stale");
assert.equal(stateFor({ qualityMode: "cinematic" }), "stale");
assert.equal(stateFor({ creatorFormat: "short_form" }), "stale");
assert.equal(stateFor({ lastFrameUrl: "https://assets.test/last-frame.jpg" }), "stale");
assert.equal(stateFor({ referenceImageUrls: ["https://assets.test/reference.jpg"] }), "stale");
assert.equal(deriveCreatorVideoCurrentness({
  currentSignature,
  videoStatus: "done",
}), "missing");

const legacyPersistedV2 = `creator-video-v2:${JSON.stringify({
  promptPolicy: "composition-safe-v1",
  text: base.text,
  motionHint: base.motionHint,
  cameraDirection: base.cameraDirection,
  emotion: base.emotion,
  imageUrl: base.imageUrl,
  lastFrameUrl: "",
  referenceImageUrls: [],
  qualityMode: base.qualityMode,
  creatorFormat: base.creatorFormat,
  duration: 27.4,
})}`;
assert.equal(deriveCreatorVideoCurrentness({
  videoUrl: "https://assets.test/scene-2.mp4",
  videoStatus: "done",
  generationSignature: legacyPersistedV2,
  currentSignature,
}), "current", "persisted raw-duration creator-video-v2 signatures remain compatible");

const continuityAudit = auditFlowContinuityScene({
  id: 2,
  source: "video",
  hasNarration: true,
  narrationDurationSec: 19.78,
  targetDurationSec: 20.53,
  videoDurationSec: 10,
});
assert.ok(continuityAudit.risks.includes("visual_gap"));
assert.ok(continuityAudit.risks.includes("freeze_frame_risk"));
const review = deriveCreatorSceneReviewReasons({
  failed: false,
  narrationState: "current",
  dialogueState: "not_required",
  videoState: "current",
  continuityAudit,
  scriptHealthStatus: "ready",
  language: "en",
});
assert.equal(review.reasons.some((reason) => reason.code === "STALE_VIDEO"), false);
assert.equal(review.reasons.some((reason) => reason.code === "VISUAL_GAP"), true);
assert.equal(review.reasons.some((reason) => reason.code === "FREEZE_FRAME_RISK"), true);

console.log("STAGE_0_18A3_VIDEO_CURRENTNESS_STABILITY=PASS");
