import assert from "node:assert/strict";
import fs from "node:fs";
import { applyCreatorSceneTextEdit } from "../lib/creator/editorState.ts";

const adultGuardSource = fs.readFileSync(
  new URL("../lib/creator/adultContentGuard.ts", import.meta.url),
  "utf8",
);
const pageSource = fs.readFileSync(
  new URL("../app/create/page.tsx", import.meta.url),
  "utf8",
);

const baseScene = {
  id: 1,
  creatorSceneId: "scene-1",
  text: "Original",
  narration: "Old narration",
  dialogue: "Old dialogue",
  audioUrl: "https://example.com/narration.mp3",
  audioPath: "narration/path.mp3",
  audioSourceText: "Old narration",
  audioSettingsKey: "narration-settings",
  dialogueAudioUrl: "https://example.com/dialogue.mp3",
  dialogueAudioPath: "dialogue/path.mp3",
  dialogueAudioSourceText: "Old dialogue",
  dialogueAudioSettingsKey: "dialogue-settings",
};

{
  const result = applyCreatorSceneTextEdit([baseScene], "scene-1", {
    text: "Original",
    narration: "New narration",
    dialogue: "Old dialogue",
  });
  assert.equal(result.changed, true);
  assert.equal(result.narrationChanged, true);
  assert.equal(result.dialogueChanged, false);
  assert.equal(result.scenes[0].audioUrl, "");
  assert.equal(result.scenes[0].audioPath, "");
  assert.equal(result.scenes[0].audioSourceText, "");
  assert.equal(result.scenes[0].audioSettingsKey, "");
  assert.equal(result.scenes[0].dialogueAudioUrl, baseScene.dialogueAudioUrl);
}

{
  const result = applyCreatorSceneTextEdit([baseScene], "scene-1", {
    text: "Original",
    narration: "Old narration",
    dialogue: "New dialogue",
  });
  assert.equal(result.changed, true);
  assert.equal(result.narrationChanged, false);
  assert.equal(result.dialogueChanged, true);
  assert.equal(result.scenes[0].audioUrl, baseScene.audioUrl);
  assert.equal(result.scenes[0].dialogueAudioUrl, "");
  assert.equal(result.scenes[0].dialogueAudioPath, "");
  assert.equal(result.scenes[0].dialogueAudioSourceText, "");
  assert.equal(result.scenes[0].dialogueAudioSettingsKey, "");
}

{
  const result = applyCreatorSceneTextEdit([baseScene], "scene-1", {
    text: "Changed visual text only",
    narration: "Old narration",
    dialogue: "Old dialogue",
  });
  assert.equal(result.changed, true);
  assert.equal(result.narrationChanged, false);
  assert.equal(result.dialogueChanged, false);
  assert.equal(result.scenes[0].audioUrl, baseScene.audioUrl);
  assert.equal(result.scenes[0].dialogueAudioUrl, baseScene.dialogueAudioUrl);
}

assert.match(
  adultGuardSource,
  /normalizeWhitespace\(scene\.audioSourceText\)\s*===\s*normalizeWhitespace\(finalNarration\)/,
  "hydration must verify narrator audio provenance against the current narration",
);
assert.match(
  adultGuardSource,
  /audioUrl:\s*narrationAudioMatches\s*\?\s*scene\.audioUrl\s*:\s*""/,
  "historic stale narrator audio must be removed during hydration",
);
assert.match(
  adultGuardSource,
  /dialogueAudioUrl:\s*dialogueAudioMatches\s*\?\s*scene\.dialogueAudioUrl\s*:\s*""/,
  "historic stale dialogue audio must be removed during hydration",
);


const updateSceneBlock = pageSource.slice(
  pageSource.indexOf("const updateScene = async"),
  pageSource.indexOf("const handleContinueStory ="),
);
assert.doesNotMatch(
  updateSceneBlock,
  /clearSceneAudioData\(sceneId\)|clearSceneDialogueAudioData\(sceneId\)/,
  "generic AI scene edit must not clear voice before narration/dialogue change is known",
);
assert.match(
  updateSceneBlock,
  /audioUrl:\s*narrationChanged\s*\?\s*""\s*:\s*scene\.audioUrl/,
  "narrator audio invalidation must be conditional on narration change",
);
assert.match(
  updateSceneBlock,
  /dialogueAudioUrl:\s*dialogueChanged\s*\?\s*""\s*:\s*scene\.dialogueAudioUrl/,
  "dialogue audio invalidation must be conditional on dialogue change",
);

for (const [startMarker, endMarker, label] of [
  ["const redrawSceneImage = async", "const editCreatorSceneVisualDirectionWithAI = async", "image regeneration"],
  ["const editCreatorSceneVisualDirectionWithAI = async", "const openCreatorSceneEditor =", "visual direction edit"],
  ["const restoreCreatorSceneAsset =", "const reuseCreatorProjectImage =", "image restore"],
  ["const reuseCreatorProjectImage =", "const useCreatorStockMedia =", "project image reuse"],
  ["const useCreatorStockMedia =", "const useCreatorUploadedMedia =", "stock image/video replacement"],
]) {
  const start = pageSource.indexOf(startMarker);
  const end = pageSource.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `${label} block must exist`);
  const block = pageSource.slice(start, end);
  assert.doesNotMatch(
    block,
    /clearSceneAudioData|clearSceneDialogueAudioData|audioUrl:\s*""|dialogueAudioUrl:\s*""/,
    `${label} must not invalidate voice assets`,
  );
}

console.log("creator-content-production-voice-invalidation-test: PASS");
