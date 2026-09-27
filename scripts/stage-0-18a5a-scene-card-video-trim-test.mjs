import assert from "node:assert/strict";
import fs from "node:fs";
import {
  deriveCreatorAudioCurrentness,
  matchesExpectedCreatorVideoSource,
  normalizeCreatorSceneTrim,
  resolveCreatorSceneVideoSourceDuration,
  updateCreatorSceneTrimById,
} from "../lib/creator/editorState.ts";
import { createCreatorVisualCoveragePlan } from "../lib/creator/visualCoverage.ts";
import { auditFlowContinuityScene } from "../lib/video/flowContinuityAudit.ts";
import {
  buildCreatorVideoGenerationSignature,
  deriveCreatorVideoCurrentness,
} from "../lib/creator/videoGeneration.ts";
import { buildCreatorFinalProductionSignature } from "../lib/creator/finalProductionSignature.ts";
import { DEFAULT_CREATOR_BACKGROUND_MUSIC } from "../lib/creator/backgroundMusic.ts";

const sceneAId = "11111111-1111-4111-8111-111111111111";
const sceneBId = "22222222-2222-4222-8222-222222222222";
const videoGenerationInput = {
  text: "A memory changes as it is recalled.", motionHint: "Slow push", cameraDirection: "Close",
  emotion: "Reflective", imageUrl: "https://assets.test/a.jpg", qualityMode: "pro",
  creatorFormat: "long_form", duration: 20.53,
};
const videoSignature = buildCreatorVideoGenerationSignature(videoGenerationInput);
const scenes = [{
  id: 1, creatorSceneId: sceneAId, videoUrl: "https://assets.test/a.mp4", videoStatus: "done",
  videoDurationSeconds: 10, image: "https://assets.test/a.jpg", targetDurationSec: 20.53,
  narration: "Narration A", dialogue: "Dialogue A", audioUrl: "voice-a.mp3",
  audioSourceText: "Narration A", audioSettingsKey: "voice-a", dialogueAudioUrl: "dialogue-a.mp3",
  dialogueAudioSourceText: "Dialogue A", dialogueAudioSettingsKey: "dialogue-a",
}, {
  id: 2, creatorSceneId: sceneBId, videoUrl: "https://assets.test/b.mp4", videoStatus: "done",
  videoDurationSeconds: 7, image: "https://assets.test/b.jpg", targetDurationSec: 12,
  clipInSec: 1, clipOutSec: 6, narration: "Narration B", dialogue: "",
}];

const update = updateCreatorSceneTrimById({
  scenes, creatorSceneId: sceneAId, clipInSec: 2, clipOutSec: 8, sourceDurationSec: 10,
});
assert.equal(update.changed, true);
assert.equal(update.scenes[0].clipInSec, 2);
assert.equal(update.scenes[0].clipOutSec, 8);
assert.equal(update.scenes[0].videoDurationSeconds, 10);
assert.equal(update.scenes[1], scenes[1], "stable-ID mutation must leave Scene B untouched");
assert.equal(normalizeCreatorSceneTrim({ clipInSec: 2, clipOutSec: 8, sourceDurationSec: 10 }).visualDurationSec, 6);

const unverifiedDuration = updateCreatorSceneTrimById({
  scenes: [{ ...scenes[0], videoDurationSeconds: 9 }],
  creatorSceneId: sceneAId,
  clipInSec: 2,
  clipOutSec: 8,
  sourceDurationSec: 10,
});
assert.equal(unverifiedDuration.changed, true);
assert.equal(
  unverifiedDuration.scenes[0].videoDurationSeconds,
  9,
  "unverified source duration may normalize trim but must not reconcile canonical duration",
);
assert.equal(unverifiedDuration.scenes[0].clipInSec, 2);
assert.equal(unverifiedDuration.scenes[0].clipOutSec, 8);

const durationReconciled = updateCreatorSceneTrimById({
  scenes: [{ ...scenes[0], videoDurationSeconds: 9 }],
  creatorSceneId: sceneAId,
  clipInSec: 2,
  clipOutSec: 8,
  sourceDurationSec: 10,
  verifiedSourceDurationSec: 10,
});
assert.equal(durationReconciled.changed, true);
assert.equal(
  durationReconciled.scenes[0].videoDurationSeconds,
  10,
  "verified current-source duration may reconcile canonical duration",
);
assert.equal(durationReconciled.scenes[0].clipInSec, 2);
assert.equal(durationReconciled.scenes[0].clipOutSec, 8);

for (const invalidVerifiedDuration of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
  const invalidReconciliation = updateCreatorSceneTrimById({
    scenes: [{ ...scenes[0], videoDurationSeconds: 9 }],
    creatorSceneId: sceneAId,
    clipInSec: 2,
    clipOutSec: 8,
    sourceDurationSec: 10,
    verifiedSourceDurationSec: invalidVerifiedDuration,
  });
  assert.equal(
    invalidReconciliation.scenes[0].videoDurationSeconds,
    9,
    "invalid verified duration must not reconcile canonical duration",
  );
}
const undoStack = [];
undoStack.push([{ ...scenes[0], videoDurationSeconds: 9 }]);
const restored = undoStack.pop();
assert.equal(restored.length, 1, "trim and duration reconciliation use one logical Undo transition");
assert.equal(restored[0].videoDurationSeconds, 9);
assert.equal(restored[0].clipInSec, undefined);
assert.equal(restored[0].clipOutSec, undefined);

assert.equal(resolveCreatorSceneVideoSourceDuration({
  cachedSource: { videoUrl: scenes[0].videoUrl, durationSec: 10 },
  videoUrl: scenes[0].videoUrl,
  persistedDurationSec: 9,
}), 10);
assert.equal(resolveCreatorSceneVideoSourceDuration({
  cachedSource: { videoUrl: scenes[0].videoUrl, durationSec: 10 },
  videoUrl: "https://assets.test/replacement.mp4",
  persistedDurationSec: 7,
}), 7, "same-scene replacement must not reuse the previous URL's browser duration");
assert.equal(matchesExpectedCreatorVideoSource({
  expectedUrl: "https://app.example/media/new.mp4",
  currentSrc: "https://app.example/media/old.mp4",
}), false, "metadata from a replaced source must be rejected");
assert.equal(matchesExpectedCreatorVideoSource({
  expectedUrl: "https://app.example/media/new.mp4",
  currentSrc: "https://app.example/media/new.mp4",
}), true, "metadata from the current source must be accepted");
assert.equal(matchesExpectedCreatorVideoSource({
  expectedUrl: "/media/new.mp4",
  currentSrc: "https://app.example/media/new.mp4",
  baseUrl: "https://app.example/create?flow=creator_lab",
}), true, "relative and browser-resolved absolute URLs must compare semantically");
assert.equal(matchesExpectedCreatorVideoSource({
  expectedUrl: "",
  currentSrc: "https://app.example/media/new.mp4",
  baseUrl: "https://app.example/",
}), false);

const coverage = createCreatorVisualCoveragePlan(update.scenes[0]);
assert.deepEqual(coverage.map((beat) => [beat.kind, beat.sourceStartSec || 0, beat.durationSec]), [
  ["video", 2, 6], ["image", 0, 14.53],
]);
const audit = auditFlowContinuityScene({
  id: 1, source: "video", targetDurationSec: 20.53, videoDurationSec: 10,
  visualCoveragePlan: coverage,
});
assert.equal(audit.risks.includes("visual_gap"), false);
assert.equal(audit.risks.includes("freeze_frame_risk"), false);

assert.equal(deriveCreatorVideoCurrentness({
  videoUrl: update.scenes[0].videoUrl, videoStatus: "done",
  generationSignature: videoSignature,
  currentSignature: buildCreatorVideoGenerationSignature(videoGenerationInput),
}), "current", "trim metadata must not stale the generated video");
assert.equal(deriveCreatorAudioCurrentness({
  spokenText: update.scenes[0].narration, audioUrl: update.scenes[0].audioUrl,
  sourceText: update.scenes[0].audioSourceText, settingsKey: "voice-a", currentSettingsKey: "voice-a",
}), "current");
assert.equal(deriveCreatorAudioCurrentness({
  spokenText: update.scenes[0].dialogue, audioUrl: update.scenes[0].dialogueAudioUrl,
  sourceText: update.scenes[0].dialogueAudioSourceText, settingsKey: "dialogue-a", currentSettingsKey: "dialogue-a",
}), "current");

const signatureFor = (scene, visualCoveragePlan) => buildCreatorFinalProductionSignature({
  scenes: [{
    ...scene, creatorSceneId: sceneAId, exportSource: "video", renderMode: "video",
    timing: { targetSceneDuration: 20.53 }, visualCoveragePlan,
  }],
  backgroundMusic: DEFAULT_CREATOR_BACKGROUND_MUSIC,
});
assert.notEqual(
  signatureFor(scenes[0], createCreatorVisualCoveragePlan(scenes[0])),
  signatureFor(update.scenes[0], coverage),
  "trim must invalidate the final composition signature",
);

const reset = updateCreatorSceneTrimById({ scenes: update.scenes, creatorSceneId: sceneAId });
assert.equal(reset.changed, true);
assert.equal(reset.scenes[0].clipInSec, undefined);
assert.equal(reset.scenes[0].clipOutSec, undefined);
assert.equal(createCreatorVisualCoveragePlan(reset.scenes[0])[0].durationSec, 10);
assert.equal(reset.scenes[0].videoUrl, scenes[0].videoUrl);
assert.equal(reset.scenes[0].image, scenes[0].image);

const page = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
assert.match(page, /data-creator-scene-card-video-trim/);
assert.match(page, /<CreatorVideoTrimControl/);
assert.match(page, /sceneOutputMode === "video" && scene\.videoUrl && scene\.videoStatus === "done"/);
assert.match(page, /creatorSceneVideoSourceDurations/);
assert.match(
  page,
  /const cachedSceneVideoSource =\s*creatorSceneVideoSourceDurations\[stableCreatorSceneId\]/,
  "scene-card trim must resolve cached metadata by stable creatorSceneId",
);
assert.match(
  page,
  /cachedSource: cachedSceneVideoSource/,
  "scene-card source-duration resolver must consume the stable-ID cache entry",
);
assert.match(page, /cached\?\.videoUrl === videoUrl/);
assert.match(page, /matchesExpectedCreatorVideoSource\(\{[\s\S]*currentSrc: event\.currentTarget\.currentSrc/);
assert.match(page, /creatorSceneVideoPreviewRefs/);
assert.match(page, /updateCreatorSceneTrim\(\{ creatorSceneId: selectedCreatorEditorSceneId/);
assert.match(page, /updateCreatorSceneTrim\(\{[\s\S]*creatorSceneId: stableCreatorSceneId/);
assert.match(
  page,
  /verifiedSourceDurationSec: verifiedSceneVideoSourceDurationSec/,
  "scene-card trim must pass canonical duration only from verified current-source metadata",
);
assert.match(page, /onPlay=[\s\S]*currentTime < start[\s\S]*currentTime = start/);
assert.match(page, /onTimeUpdate=[\s\S]*currentTime >= end - 0\.02[\s\S]*pause\(\)/);
assert.match(page, /onSeeking=[\s\S]*currentTime < start[\s\S]*currentTime > end/);
assert.match(page, /sceneTrimDisabled[\s\S]*scene\.videoStatus === "processing"[\s\S]*scene\.videoStatus === "delayed"/);
assert.match(page, /applyCreatorEditorStructuralChange\([\s\S]*undoLabel: result\.reset/);
assert.equal((page.match(/data-production-primary-continue="true"/g) || []).length, 1);
assert.ok(
  page.indexOf('data-production-primary-continue="true"') > page.indexOf('id="creatorlab-production-customize"'),
  "the single Create & Review transition belongs after Production Setup content",
);

console.log("STAGE_0_18A5A_SCENE_CARD_VIDEO_TRIM=PASS");
