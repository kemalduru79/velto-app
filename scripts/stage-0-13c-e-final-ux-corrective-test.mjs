import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectUploadedCreatorMusic, setCreatorMusicSetupMode } from "../lib/creator/musicSetup.ts";
import { getCreatorSceneMusicState, startOrChangeCreatorSceneMusic, stopCreatorSceneMusicAfter } from "../lib/creator/sceneMusic.ts";

const scenes = Array.from({ length: 12 }, (_, index) => `scene-${index + 1}`);
const asset = (assetId, displayName = assetId) => ({ assetId, displayName, origin: "uploaded", mediaKind: "music", rights: { status: "creator_attested" } });
const start = (timeline, selectedAsset) => selectUploadedCreatorMusic({ timeline, sceneIds: scenes, asset: selectedAsset });
const transition = (timeline, sceneId, selectedAsset) => startOrChangeCreatorSceneMusic({ timeline, sceneIds: scenes, sceneId, choice: { mode: "asset", asset: selectedAsset } });

const trackA = asset("track-a", "Track A");
const trackB = asset("track-b", "Track B");
const trackC = asset("track-c", "Track C");
const trackD = asset("track-d", "Track D");

const aThenB = transition(start(undefined, trackA), "scene-8", trackB);
assert.equal(aThenB.placements.length, 2);
assert.equal(getCreatorSceneMusicState(aThenB, scenes, "scene-7").effective?.asset?.assetId, "track-a");
assert.equal(getCreatorSceneMusicState(aThenB, scenes, "scene-8").effective?.asset?.assetId, "track-b");

const cThenB = start(aThenB, trackC);
assert.equal(cThenB.placements.length, 2);
assert.equal(getCreatorSceneMusicState(cThenB, scenes, "scene-7").effective?.asset?.assetId, "track-c");
assert.equal(getCreatorSceneMusicState(cThenB, scenes, "scene-8").effective?.asset?.assetId, "track-b");

const noMusicThenD = transition(setCreatorMusicSetupMode(cThenB, "none"), "scene-5", trackD);
assert.equal(getCreatorSceneMusicState(noMusicThenD, scenes, "scene-4").effective, undefined);
assert.equal(getCreatorSceneMusicState(noMusicThenD, scenes, "scene-5").effective?.asset?.assetId, "track-d");
assert.equal(noMusicThenD.musicIntent?.mode, "none");

const stopped = stopCreatorSceneMusicAfter({ timeline: noMusicThenD, sceneIds: scenes, sceneId: "scene-10" });
assert.equal(getCreatorSceneMusicState(stopped, scenes, "scene-10").stops, true);
assert.equal(getCreatorSceneMusicState(stopped, scenes, "scene-11").effective, undefined);
assert.equal(stopped.placements.every((placement) => !("startMs" in placement.range) && !("endMs" in placement.range)), true);

const setup = readFileSync(new URL("../components/create/CreatorBackgroundMusic.tsx", import.meta.url), "utf8");
const controls = readFileSync(new URL("../components/create/CreatorSceneMusicControls.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
for (const label of ["Auto Match", "No Music", "Choose Music", "Upload your own music"]) assert.match(setup, new RegExp(label));
for (const label of ["Using", "Music changes here", "No music is active here", "Change music here", "Stop music after this scene", "Start music here"]) assert.match(controls, new RegExp(label));
assert.doesNotMatch(controls, />Continue</);
assert.equal((setup.match(/<CreatorMusicLibraryPicker/g) || []).length, 2);
assert.equal((controls.match(/<CreatorMusicLibraryPicker/g) || []).length, 1);
assert.match(page, /type CreatorSceneInspectorTab = "script" \| "visual" \| "audio" \| "music"/);
for (const step of ["script", "visual", "audio", "music"]) assert.match(page, new RegExp(`data-production-step="${step}"`));
assert.match(page, /creatorSelectedSceneIds\.length > 1 \|\| creatorVisualDispatchCountdown/);
assert.doesNotMatch(setup + controls, />\s*(?:Volume|Gain|Fade|Ducking|BPM|Waveform|Timeline|Continue)\s*</i);

console.log("STAGE_0_13C_E_FINAL_UX_CORRECTIVE=PASS");
