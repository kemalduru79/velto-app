import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveCreatorFinalSceneExportSelections } from "../lib/creator/finalSceneExportSelection.ts";
import { buildCreatorFinalProductionSignature } from "../lib/creator/finalProductionSignature.ts";

const scene = {
  id: 1,
  creatorSceneId: "scene-1",
  image: "https://media.test/current-image.jpg?token=current",
  videoUrl: "https://media.test/older-video.mp4?token=old",
  videoStatus: "done",
  audioUrl: "https://media.test/narration.mp3?token=speech",
  timing: { targetSceneDuration: 10, narrationDuration: 8, dialogueDuration: 0, speechTailBuffer: 0.5 },
};
const imageDecision = [{ sceneId: 1, selectedTreatment: "image_motion" }];
const clientSelection = resolveCreatorFinalSceneExportSelections([scene], imageDecision);
const serverSelection = resolveCreatorFinalSceneExportSelections([structuredClone(scene)], imageDecision);
assert.deepEqual(clientSelection, serverSelection);
assert.deepEqual(clientSelection[0], {
  creatorSceneId: "scene-1",
  effectiveRenderMode: "image",
  exportSource: "image",
  selectedMedia: scene.image,
});

const selectedScenes = (selection, source = scene) => [{
  ...source,
  renderMode: selection[0].effectiveRenderMode,
  exportSource: selection[0].exportSource,
}];
const signature = (selection, source = scene, audioTimeline = null) => buildCreatorFinalProductionSignature({
  scenes: selectedScenes(selection, source),
  backgroundMusic: { mode: "none", volume: 0.3, autoDucking: true, fadeInSec: 1, fadeOutSec: 1 },
  audioTimeline,
});
assert.equal(signature(clientSelection), signature(serverSelection), "client and server selection signatures match");
assert.equal(signature(clientSelection), signature(resolveCreatorFinalSceneExportSelections([{ ...scene, videoUrl: "https://media.test/another-stale-video.mp4", videoStatus: "done" }], imageDecision), { ...scene, videoUrl: "https://media.test/another-stale-video.mp4" }), "unused stale alternate video cannot change an image selection signature");
assert.notEqual(signature(clientSelection), signature(clientSelection, { ...scene, image: "https://media.test/changed-image.jpg" }), "selected production mutation changes signature");

const timeline = { version: 1, timingBasis: "scene_anchored", musicIntent: { mode: "none" }, placements: [], master: { version: 1, gains: { narration: 1, music: 1, ambience: 1, sfx: 1 }, limiter: { enabled: true, ceiling: 0.95 } } };
assert.notEqual(signature(clientSelection, scene, null), signature(clientSelection, scene, timeline), "AudioTimeline mutation changes signature");

const publish = readFileSync(new URL("../lib/creator/publishReadiness.server.ts", import.meta.url), "utf8");
const endpoint = readFileSync(new URL("../app/api/creator-publish-readiness/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
assert.match(publish, /resolveCreatorFinalSceneExportSelections/);
assert.doesNotMatch(publish, /function sceneExportSource/);
assert.match(publish, /canonical\.signature !== finalVideoSignature/);
assert.match(publish, /requestedFinalVideoUrl[\s\S]*!== finalVideoUrl/);
assert.match(publish, /resolveAudioRenderability \|\| resolveCreatorAudioRenderability/);
assert.match(endpoint, /resolveCreatorPublishAuthority/);
assert.match(page, /\/api\/creator-publish-readiness\?projectId=/);
assert.match(page, /ready: creatorServerPublishReadiness\.ready/);
const finalVideoSystemCheck = page.slice(page.indexOf('key: "finalVideo"'), page.indexOf('key: "thumbnail"'));
assert.match(finalVideoSystemCheck, /ready: creatorServerPublishReadiness\.ready/);
assert.doesNotMatch(finalVideoSystemCheck, /creatorProductionComplete|hasReusableExport/);
const packageAction = page.slice(page.indexOf("const handleDownloadCreatorPackage"), page.indexOf("const getShortThumbnailHeadline"));
assert.match(packageAction, /if \(!creatorServerPublishReadiness\.ready\)/);
assert.doesNotMatch(packageAction, /if \(!hasReusableExport\(\)\)/);

console.log("STAGE_0_13C_H_FINAL_SIGNATURE_NORMALIZATION=PASS");
