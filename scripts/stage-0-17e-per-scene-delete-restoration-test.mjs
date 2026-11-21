import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { removeCreatorScene } from "../lib/creator/editorState.ts";
import {
  DEFAULT_CREATOR_AUDIO_MASTER_MIX,
  reconcileCreatorAudioTimeline,
} from "../lib/creator/audioTimeline.ts";

const page = readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";
const C = "10000000-0000-4000-8000-000000000003";
const richScene = (id, creatorSceneId, label) => ({
  id,
  creatorSceneId,
  narration: `${label} narration`,
  dialogue: `${label} dialogue`,
  audioUrl: `${label}.mp3`,
  audioPath: `audio/${label}.mp3`,
  audioSourceText: `${label} narration`,
  audioSettingsKey: `${label}-narrator-settings`,
  dialogueAudioUrl: `${label}-dialogue.mp3`,
  dialogueAudioPath: `audio/${label}-dialogue.mp3`,
  dialogueAudioSourceText: `${label} dialogue`,
  dialogueAudioSettingsKey: `${label}-dialogue-settings`,
  image: `${label}.png`,
  videoUrl: `${label}.mp4`,
  assetHistory: [{ id: `${label}-asset`, url: `${label}.png` }],
  timing: { targetSceneDuration: id * 5 },
});
const source = [richScene(7, A, "A"), richScene(8, B, "B"), richScene(9, C, "C")];

const middle = removeCreatorScene(source, B);
assert.equal(middle.removed, true);
assert.deepEqual(middle.scenes.map((scene) => scene.creatorSceneId), [A, C]);
assert.deepEqual(middle.scenes.map((scene) => scene.id), [1, 2]);
assert.equal(middle.selectedCreatorSceneId, C, "middle deletion focuses the logical next stable scene");
for (const creatorSceneId of [A, C]) {
  const before = source.find((scene) => scene.creatorSceneId === creatorSceneId);
  const after = middle.scenes.find((scene) => scene.creatorSceneId === creatorSceneId);
  for (const field of ["narration", "dialogue", "audioUrl", "audioPath", "audioSourceText", "audioSettingsKey", "dialogueAudioUrl", "dialogueAudioPath", "dialogueAudioSourceText", "dialogueAudioSettingsKey", "image", "videoUrl", "assetHistory", "timing"]) {
    assert.deepEqual(after[field], before[field], `${creatorSceneId} preserves ${field}`);
  }
}

const final = removeCreatorScene(source, C);
assert.equal(final.selectedCreatorSceneId, B, "deleting the last scene focuses the previous stable scene");
assert.equal(removeCreatorScene([source[0]], A).removed, false, "the final remaining scene is protected");
const secondDelete = removeCreatorScene(middle.scenes, C);
assert.deepEqual(secondDelete.scenes.map((scene) => scene.creatorSceneId), [A], "reordinalization cannot redirect a later stable-ID delete");

const timeline = {
  version: 1,
  timingBasis: "scene_anchored",
  master: DEFAULT_CREATOR_AUDIO_MASTER_MIX,
  placements: [{
    id: "music",
    kind: "music",
    asset: { assetId: "music-asset", origin: "uploaded", mediaKind: "music", rights: { status: "creator_attested" } },
    range: {
      start: { sceneId: A, edge: "start", offsetMs: 0 },
      end: { sceneId: C, edge: "end", offsetMs: 0 },
    },
    sourceInMs: 0,
    gain: 0.2,
    fades: { inMs: 100, outMs: 100 },
    ducking: { mode: "under_speech" },
    status: "active",
  }],
};
const reconciled = reconcileCreatorAudioTimeline({
  timeline,
  previousScenes: source,
  nextScenes: middle.scenes,
});
assert.equal(reconciled.timeline.placements[0].range.start.sceneId, A);
assert.equal(reconciled.timeline.placements[0].range.end.sceneId, C);
assert.equal(reconciled.timeline.placements[0].asset.assetId, "music-asset");

assert.match(page, /data-delete-creator-scene=\{scene\.creatorSceneId \|\| "missing"\}/);
assert.match(page, /onClick=\{\(\) => scene\.creatorSceneId && deleteCreatorScene\(scene\.creatorSceneId\)\}/);
assert.match(page, /const deleteCreatorScene = \(creatorSceneId: string\)/);
assert.match(page, /window\.confirm\([\s\S]*Existing media will not be deleted[\s\S]*if \(!confirmed\) return;[\s\S]*removeCreatorScene\(scenes, creatorSceneId\)/);
assert.match(page, /disabled=\{[\s\S]*scenes\.length <= 1[\s\S]*creatorSceneStructuralOperationsDisabled/);
assert.match(page, /creatorSceneStructuralOperationsDisabled =[\s\S]*isBatchRendering[\s\S]*imageDispatchCountdown[\s\S]*videoDispatchCountdown[\s\S]*videoStatus === "processing"/);
assert.match(page, /audioTimeline: creatorAudioTimeline[\s\S]*setCreatorAudioTimeline\([\s\S]*entry\.audioTimeline/);
assert.match(page, /focusedCreatorSceneId:[\s\S]*creatorFocusedSceneId[\s\S]*creatorSceneId === entry\.focusedCreatorSceneId/);
assert.match(page, /nextScenes\.find\([\s\S]*creatorSceneId === selectedCreatorSceneId[\s\S]*setCreatorFocusedSceneId/);

const deleteBlock = page.slice(page.indexOf("const deleteCreatorScene"), page.indexOf("const duplicateSelectedCreatorEditorScene"));
assert.doesNotMatch(deleteBlock, /fetch\(|\/api\/|provider|credit|reserve|storage/i, "deletion performs no API, provider, credit, or storage operation");

console.log("STAGE_0_17E_PER_SCENE_DELETE_RESTORATION=PASS");
