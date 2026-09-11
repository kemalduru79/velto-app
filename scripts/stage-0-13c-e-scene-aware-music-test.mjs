import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDefaultCreatorMusicTimeline, selectUploadedCreatorMusic } from "../lib/creator/musicSetup.ts";
import { normalizeCreatorAudioTimeline, reconcileCreatorAudioTimeline } from "../lib/creator/audioTimeline.ts";
import { getCreatorSceneMusicState, startOrChangeCreatorSceneMusic, stopCreatorSceneMusicAfter } from "../lib/creator/sceneMusic.ts";

const sceneIds = ["scene-a", "scene-b", "scene-c", "scene-d"];
assert.equal(getCreatorSceneMusicState(createDefaultCreatorMusicTimeline(), sceneIds, "scene-c").activeBefore, true);
const auto = startOrChangeCreatorSceneMusic({ timeline: createDefaultCreatorMusicTimeline(), sceneIds, sceneId: "scene-b", choice: { mode: "auto" } });
assert.equal(auto.placements.length, 2);
assert.equal(auto.placements[1].status, "unresolved");
assert.deepEqual(auto.placements[1].musicSelection, { mode: "auto" });
assert.equal(auto.placements[1].asset, undefined);
assert.deepEqual(auto.placements[1].range.start, { sceneId: "scene-b", edge: "start", offsetMs: 0 });
assert.deepEqual(auto.placements[1].range.end, { sceneId: "scene-d", edge: "end", offsetMs: 0 });
assert.equal("startMs" in auto.placements[1].range, false);
assert.equal(getCreatorSceneMusicState(auto, sceneIds, "scene-c").activeBefore, true);

const repeated = startOrChangeCreatorSceneMusic({ timeline: auto, sceneIds, sceneId: "scene-b", choice: { mode: "auto" } });
assert.equal(repeated.placements.length, 2);
assert.deepEqual(repeated, auto);

const asset = { assetId: "owned-track", displayName: "Owned.mp3", origin: "uploaded", mediaKind: "music", rights: { status: "creator_attested" } };
const changed = startOrChangeCreatorSceneMusic({ timeline: repeated, sceneIds, sceneId: "scene-c", choice: { mode: "asset", asset } });
assert.equal(changed.placements.length, 3);
assert.deepEqual(changed.placements[1].range.end, { sceneId: "scene-c", edge: "start", offsetMs: 0 });
assert.deepEqual(changed.placements[2].range.start, { sceneId: "scene-c", edge: "start", offsetMs: 0 });
assert.equal(changed.placements[2].asset, asset);

const stopped = stopCreatorSceneMusicAfter({ timeline: changed, sceneIds, sceneId: "scene-c" });
assert.deepEqual(stopped.placements[2].range.end, { sceneId: "scene-c", edge: "end", offsetMs: 0 });
const restarted = startOrChangeCreatorSceneMusic({ timeline: stopped, sceneIds, sceneId: "scene-d", choice: { mode: "auto" } });
assert.equal(restarted.placements.length, 4);

const prior = sceneIds.map((creatorSceneId) => ({ creatorSceneId }));
const reordered = reconcileCreatorAudioTimeline({ timeline: changed, previousScenes: prior, nextScenes: ["scene-d", "scene-a", "scene-b", "scene-c"].map((creatorSceneId) => ({ creatorSceneId })) });
assert.equal(reordered.timeline.placements[2].range.start.sceneId, "scene-c");
const deleted = reconcileCreatorAudioTimeline({ timeline: changed, previousScenes: prior, nextScenes: ["scene-a", "scene-b", "scene-d"].map((creatorSceneId) => ({ creatorSceneId })) });
assert.equal(deleted.timeline.placements.every((item) => item.status === "unresolved"), true);
assert.equal(deleted.timeline.placements.some((item) => item.range.start.sceneId === "scene-d"), false);
assert.deepEqual(normalizeCreatorAudioTimeline(changed), changed);
assert.equal(selectUploadedCreatorMusic({ timeline: createDefaultCreatorMusicTimeline(), sceneIds, asset }).placements[0].asset, asset);

const controls = readFileSync(new URL("../components/create/CreatorSceneMusicControls.tsx", import.meta.url), "utf8");
const editor = readFileSync(new URL("../components/create/CreatorEditor.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
assert.match(editor, /<CreatorSceneMusicControls/);
for (const label of ["Start music here", "Change music here", "Stop music after this scene", "No music is active here"]) assert.match(controls, new RegExp(label));
assert.doesNotMatch(controls, />Continue</);
assert.equal((controls.match(/data-scene-music-control/g) || []).length, 1);
assert.doesNotMatch(controls, /volume|gain|fade|ducking|waveform|scrubber|sourceIn|sourceOut|provider/i);
assert.doesNotMatch(controls, /fetch\(|creator-audio-assets|uploadToSignedUrl/);
assert.match(page, /reconcileCreatorAudioTimeline/);

console.log("STAGE_0_13C_E_SCENE_AWARE_MUSIC=PASS");
