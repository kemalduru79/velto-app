import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { continueCreatorSceneMusicAfter, getCreatorSceneMusicState, startOrChangeCreatorSceneMusic, stopCreatorSceneMusicAfter } from "../lib/creator/sceneMusic.ts";
import { buildCreatorFinalProductionSignature } from "../lib/creator/finalProductionSignature.ts";

const sceneIds = ["scene-1", "scene-2", "scene-3"];
const master = { version: 1, gains: { narration: 1, music: 1, ambience: 1, sfx: 1 }, limiter: { enabled: true, ceiling: 0.95 } };
const empty = { version: 1, timingBasis: "scene_anchored", musicIntent: { mode: "none" }, placements: [], master };
const asset = (id) => ({ assetId: `catalog:${id}`, displayName: id, origin: "licensed_catalog", mediaKind: "music", rights: { status: "verified" } });
const withA = startOrChangeCreatorSceneMusic({ timeline: empty, sceneIds, sceneId: "scene-1", choice: { mode: "asset", asset: asset("A") } });
const withB = startOrChangeCreatorSceneMusic({ timeline: withA, sceneIds, sceneId: "scene-2", choice: { mode: "asset", asset: asset("B") } });
const stopped = stopCreatorSceneMusicAfter({ timeline: withB, sceneIds, sceneId: "scene-2" });
assert.deepEqual(stopped.placements.at(-1).range.end, { sceneId: "scene-2", edge: "end", offsetMs: 0 });
assert.equal(getCreatorSceneMusicState(stopped, sceneIds, "scene-2").stops, true);

const continued = continueCreatorSceneMusicAfter({ timeline: stopped, sceneIds, sceneId: "scene-2" });
assert.deepEqual(continued.placements.at(-1).range.end, { sceneId: "scene-3", edge: "end", offsetMs: 0 });
assert.equal(getCreatorSceneMusicState(continued, sceneIds, "scene-2").stops, false);
assert.notDeepEqual(stopped, continued);

const scenes = sceneIds.map((creatorSceneId, index) => ({ id: index + 1, creatorSceneId, renderMode: "image", exportSource: "image", image: `https://media.test/${creatorSceneId}.jpg` }));
const signature = (audioTimeline) => buildCreatorFinalProductionSignature({ scenes, backgroundMusic: { mode: "none", volume: 0.3, autoDucking: true, fadeInSec: 1, fadeOutSec: 1 }, audioTimeline });
const stoppedSignature = signature(stopped);
const continuedSignature = signature(continued);
assert.notEqual(stoppedSignature, continuedSignature, "Stop After is part of final-output currency");
assert.equal(stoppedSignature, signature(stopped), "a rebuild under A restores A currency");
assert.equal(continuedSignature, signature(continued), "a rebuild under B restores B currency");

const controls = readFileSync(new URL("../components/create/CreatorSceneMusicControls.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const handler = page.slice(page.indexOf("const applyCreatorAudioTimelineChange"), page.indexOf("const saveProject"));
assert.match(controls, /aria-pressed=\{state\.stops\}/);
assert.match(controls, /state\.stops \? continueCreatorSceneMusicAfter/);
assert.match(controls, /✓ Music stops after this scene/);
assert.match(controls, /Music plays through this scene, then stops\./);
assert.match(controls, /Music continues naturally until you change or stop it\./);
const changeButton = controls.match(/<button type="button"[^>]*onClick=\{\(\) => setChoosing\(true\)\}[^>]*>/)?.[0] || "";
assert.ok(changeButton);
assert.doesNotMatch(changeButton, /aria-pressed/);
assert.match(page, /onChange=\{applyCreatorAudioTimelineChange\}/);
assert.match(handler, /setCreatorAudioTimeline\(nextTimeline\)/);
assert.match(handler, /persistProject\(false, \{[\s\S]*audioTimeline: nextTimeline/);
assert.doesNotMatch(handler, /setExportedMovieUrl\(""\)|setExportSignature\(""\)|forceInvalidateFinalVideo/);

console.log("STAGE_0_13C_H_STOP_AFTER_INVALIDATION=PASS");
