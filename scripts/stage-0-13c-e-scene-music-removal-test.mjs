import assert from "node:assert/strict";
import { attachCreatorProjectState, buildCreatorProjectState, readCreatorProjectState } from "../lib/creator/projectState.ts";
import { deriveCreatorAudioPreviewPlan } from "../lib/creator/audioPreviewPlan.ts";
import { creatorAcquiredCatalogTrackAsset, createDefaultCreatorMusicTimeline } from "../lib/creator/musicSetup.ts";
import { getCreatorSceneMusicState, removeCreatorSceneMusic, startOrChangeCreatorSceneMusic } from "../lib/creator/sceneMusic.ts";

const sceneIds = ["scene-1", "scene-2", "scene-3"];
const asset = creatorAcquiredCatalogTrackAsset({ id: "shared-track", title: "Shared", moods: [], genres: [], previewAvailable: true });
const assigned = startOrChangeCreatorSceneMusic({
  timeline: createDefaultCreatorMusicTimeline(), sceneIds, sceneId: "scene-1", choice: { mode: "asset", asset },
});
const removed = removeCreatorSceneMusic({ timeline: assigned, sceneIds, sceneId: "scene-2" });
const snapshot = buildCreatorProjectState({
  brief: {
    topic: "Music removal", language: "en", country: "global", ageGroup: "professional_18",
    contentType: "educational_explainer", format: "youtube_video", durationPreset: "short_60",
    durationSec: 60, customDurationSec: 60, qualityMode: "standard", targetPlatforms: ["youtube"],
  },
  strategy: { mentorResult: null, selectedDirectionId: "recommended", selectedHook: "", script: null },
  production: {
    package: null, refinedScenes: [], backgroundMusic: { mode: "none" }, audioTimeline: removed,
    projectContinuityMode: "independent", sceneContinuityModes: {}, voicePreferences: null,
  },
  createReview: { scenes: [] },
  publish: { metadata: null, thumbnail: null, thumbnailDesign: null, confirmations: {}, packageDownloaded: false, packageSignature: "", finalVideoUrl: "", finalVideoSignature: "" },
});
const reloaded = readCreatorProjectState({
  flow_type: "creator_lab", input_prompt: "Music removal", language: "en", scenes: [],
  exported_movie_result: attachCreatorProjectState({}, JSON.parse(JSON.stringify(snapshot))),
});
const timeline = reloaded.production.audioTimeline;
assert.equal(getCreatorSceneMusicState(timeline, sceneIds, "scene-1").effective?.asset?.assetId, "catalog:shared-track");
assert.equal(getCreatorSceneMusicState(timeline, sceneIds, "scene-2").effective, undefined);
assert.equal(getCreatorSceneMusicState(timeline, sceneIds, "scene-3").effective?.asset?.assetId, "catalog:shared-track");
const plan = deriveCreatorAudioPreviewPlan({ timeline, scenes: sceneIds.map((creatorSceneId) => ({ creatorSceneId, durationMs: 1000, narrationDurationMs: 0 })) });
assert.deepEqual(plan.scenes.map((scene) => scene.music?.trackId || null), ["shared-track", null, "shared-track"]);
assert.equal(removed.placements.filter((placement) => placement.asset?.assetId === "catalog:shared-track").length, 2, "removal retains adjacent references without deleting shared assets");
assert.equal(removed.placements.filter((placement) => placement.asset?.assetId === "catalog:shared-track").every((placement) => placement.asset?.rights.status === "verified"), true);

console.log("STAGE_0_13C_E_SCENE_MUSIC_REMOVAL=PASS");
