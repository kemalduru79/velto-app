import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { buildCreatorProjectState } from "../lib/creator/projectState.ts";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const helperSource = read("lib/creator/editorState.ts");
const page = read("app/create/page.tsx");
const helperJs = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helper = await import(`data:text/javascript;base64,${Buffer.from(helperJs).toString("base64")}`);

const ids = {
  alpha: "10000000-0000-4000-8000-000000000001",
  beta: "10000000-0000-4000-8000-000000000002",
  gamma: "10000000-0000-4000-8000-000000000003",
};
const scene = (id, creatorSceneId, label) => ({
  id,
  creatorSceneId,
  text: `${label} visual`,
  narration: `${label} narration.`,
  dialogue: label === "Alpha" ? "" : `Speaker: ${label} dialogue.`,
  audioUrl: `${label.toLowerCase()}.mp3`,
  audioPath: `${label.toLowerCase()}/path`,
  audioSourceText: `${label} narration.`,
  audioSettingsKey: "voice-key",
  dialogueAudioUrl: label === "Alpha" ? "" : `${label.toLowerCase()}-dialogue.mp3`,
  dialogueAudioPath: label === "Alpha" ? "" : `${label.toLowerCase()}/dialogue-path`,
  dialogueAudioSourceText: label === "Alpha" ? "" : `Speaker: ${label} dialogue.`,
  dialogueAudioSettingsKey: label === "Alpha" ? "" : "dialogue-key",
  timing: { narrationDuration: 2, dialogueDuration: label === "Alpha" ? 0 : 1 },
});
const original = [scene(1, ids.alpha, "Alpha"), scene(2, ids.beta, "Beta"), scene(3, ids.gamma, "Gamma")];
const voiceFields = (value) => ({
  audioUrl: value.audioUrl,
  audioPath: value.audioPath,
  audioSourceText: value.audioSourceText,
  audioSettingsKey: value.audioSettingsKey,
  dialogueAudioUrl: value.dialogueAudioUrl,
  dialogueAudioPath: value.dialogueAudioPath,
  dialogueAudioSourceText: value.dialogueAudioSourceText,
  dialogueAudioSettingsKey: value.dialogueAudioSettingsKey,
});
const currentness = (spokenText, audioUrl, sourceText, settingsKey, currentSettingsKey) =>
  helper.deriveCreatorAudioCurrentness({ spokenText, audioUrl, sourceText, settingsKey, currentSettingsKey });

const narrationEdit = helper.applyCreatorSceneTextEdit(original, ids.beta, {
  text: original[1].text,
  narration: "Beta narration changed.",
  dialogue: original[1].dialogue,
});
assert.equal(narrationEdit.changed, true);
assert.deepEqual(voiceFields(narrationEdit.scenes[0]), voiceFields(original[0]));
assert.deepEqual(voiceFields(narrationEdit.scenes[2]), voiceFields(original[2]));
assert.equal(currentness(narrationEdit.scenes[1].narration, narrationEdit.scenes[1].audioUrl, narrationEdit.scenes[1].audioSourceText, narrationEdit.scenes[1].audioSettingsKey, "voice-key"), "stale");
assert.equal(currentness(narrationEdit.scenes[1].dialogue, narrationEdit.scenes[1].dialogueAudioUrl, narrationEdit.scenes[1].dialogueAudioSourceText, narrationEdit.scenes[1].dialogueAudioSettingsKey, "dialogue-key"), "current", "narration-only edit preserves target dialogue voice");
assert.equal(currentness(narrationEdit.scenes[2].dialogue, narrationEdit.scenes[2].dialogueAudioUrl, narrationEdit.scenes[2].dialogueAudioSourceText, narrationEdit.scenes[2].dialogueAudioSettingsKey, "dialogue-key"), "current");

const dialogueBase = [{ ...original[1], dialogue: "Speaker: Original.", dialogueAudioUrl: "beta-dialogue.mp3", dialogueAudioPath: "beta/dialogue", dialogueAudioSourceText: "Speaker: Original.", dialogueAudioSettingsKey: "dialogue-key" }];
const dialogueEdit = helper.applyCreatorSceneTextEdit(dialogueBase, ids.beta, { text: dialogueBase[0].text, narration: dialogueBase[0].narration, dialogue: "Speaker: Changed." }).scenes[0];
assert.equal(currentness(dialogueEdit.narration, dialogueEdit.audioUrl, dialogueEdit.audioSourceText, dialogueEdit.audioSettingsKey, "voice-key"), "current");
assert.equal(currentness(dialogueEdit.dialogue, dialogueEdit.dialogueAudioUrl, dialogueEdit.dialogueAudioSourceText, dialogueEdit.dialogueAudioSettingsKey, "dialogue-key"), "stale");

const visualEdit = helper.applyCreatorSceneTextEdit(original, ids.beta, { text: "New visual only", narration: original[1].narration, dialogue: original[1].dialogue }).scenes[1];
assert.equal(currentness(visualEdit.narration, visualEdit.audioUrl, visualEdit.audioSourceText, visualEdit.audioSettingsKey, "voice-key"), "current");
assert.equal(currentness("Alpha narration.", narrationEdit.scenes[0].audioUrl, narrationEdit.scenes[0].audioSourceText, narrationEdit.scenes[0].audioSettingsKey, "voice-key"), "current");
assert.equal(currentness("Beta narration.", narrationEdit.scenes[1].audioUrl, narrationEdit.scenes[1].audioSourceText, narrationEdit.scenes[1].audioSettingsKey, "voice-key"), "current", "exact restore reuses preserved provenance");

const persisted = JSON.parse(JSON.stringify(buildCreatorProjectState({
  brief: { topic: "Memory", language: "en", country: "global", ageGroup: "professional_18", contentType: "documentary", format: "youtube_video", durationPreset: "custom", durationSec: 300, customDurationSec: 300, qualityMode: "pro", targetPlatforms: ["youtube"] },
  strategy: { mentorResult: {}, selectedDirectionId: "direction", selectedHook: "hook", script: null },
  production: { package: null, refinedScenes: narrationEdit.scenes, backgroundMusic: null, projectContinuityMode: "independent", sceneContinuityModes: {}, voicePreferences: null },
  createReview: { scenes: narrationEdit.scenes },
  publish: { metadata: null, thumbnail: null, thumbnailDesign: null, confirmations: {}, packageDownloaded: false, packageSignature: "", finalVideoUrl: "", finalVideoSignature: "" },
})));
assert.deepEqual(voiceFields(persisted.createReview.scenes[0]), voiceFields(original[0]));
assert.deepEqual(voiceFields(persisted.createReview.scenes[2]), voiceFields(original[2]));
assert.deepEqual(voiceFields(persisted.production.refinedScenes[2]), voiceFields(original[2]));

const reordered = [{ ...original[2], id: 1 }, { ...original[0], id: 2 }, { ...original[1], id: 3 }];
const stableEdit = helper.applyCreatorSceneTextEdit(reordered, ids.beta, { text: reordered[2].text, narration: "Stable target changed.", dialogue: reordered[2].dialogue });
assert.equal(stableEdit.scenes[2].narration, "Stable target changed.");
assert.equal(stableEdit.scenes[1].narration, "Alpha narration.", "numeric ordinal cannot redirect invalidation");

const saveBlock = page.slice(page.indexOf("const saveCreatorSceneScript"), page.indexOf("const updateCreatorDirectorActionState"));
assert.match(saveBlock, /targetCreatorSceneId = existingScene\.creatorSceneId/);
assert.match(saveBlock, /scene\.creatorSceneId !== targetCreatorSceneId/);
assert.doesNotMatch(saveBlock, /clearSceneAudioData|clearSceneDialogueAudioData/);
assert.doesNotMatch(saveBlock, /audioUrl:\s*""|dialogueAudioUrl:\s*""/);
assert.match(saveBlock, /setRefinedCreatorScenes\(\(prev\) => prev\.map\(updateScriptFields\)\)/);

const projectionBlock = page.slice(page.indexOf("const projectCreatorEditorScenes"), page.indexOf("const applyCreatorEditorStructuralChange"));
for (const field of ["audioUrl", "audioPath", "audioSourceText", "audioSettingsKey", "dialogueAudioUrl", "dialogueAudioPath", "dialogueAudioSourceText", "dialogueAudioSettingsKey", "timing"]) {
  assert.match(projectionBlock, new RegExp(`${field}: scene\\.${field}`), `${field} must survive projection/persistence`);
}
assert.doesNotMatch(saveBlock, /fetch\(|provider|credit|reserve|storage.*delete|delete.*storage/i);

console.log("STAGE_0_17B_SCENE_LOCAL_VOICE_INVALIDATION=PASS");
