import assert from "node:assert/strict";
import fs from "node:fs";
import { applyCreatorSceneTextEdit } from "../lib/creator/editorState.ts";

const adultGuardSource = fs.readFileSync(
  new URL("../lib/creator/adultContentGuard.ts", import.meta.url),
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

console.log("creator-content-production-voice-invalidation-test: PASS");
