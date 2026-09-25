import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  deriveCreatorAudioCurrentness,
  moveCreatorScene,
  removeCreatorScene,
} from "../lib/creator/editorState.ts";

const settingsKey = ({
  target = 18.1,
  routeSpeed = 1.02,
  timing = "safe",
  index = 0,
  count = 36,
  voiceId = "voice-a",
  profile = "documentary",
  role = "narrator",
  quality = "pro",
  format = "long_form",
  strategy = "premium_narration",
  model = "eleven_multilingual_v2",
  stability = 0.5,
  similarityBoost = 0.75,
  style = 0.1,
  userSpeed = 1,
  identity = `${profile}-${role}:${voiceId}`,
} = {}) => [
  voiceId,
  model,
  stability,
  similarityBoost,
  style,
  userSpeed,
  [
    "creator-voice-v1",
    quality,
    format,
    role,
    profile,
    strategy,
    target,
    routeSpeed,
    timing,
    index,
    count,
    "explicit",
  ].join(":"),
  identity,
].join("-");

const narration = "Memory is reconstructed each time we recall it.";
const currentness = (input = {}, overrides = {}) => deriveCreatorAudioCurrentness({
  spokenText: narration,
  audioUrl: "https://assets.test/scene-1.mp3",
  sourceText: narration,
  settingsKey: settingsKey(),
  currentSettingsKey: settingsKey(input),
  ...overrides,
});

assert.equal(
  currentness({ target: 16.95, routeSpeed: 1.08, timing: "tight", index: 4, count: 35 }),
  "current",
  "timeline and topology replanning must not stale unchanged narration",
);
assert.equal(currentness({ target: 12 }), "current");
assert.equal(currentness({ routeSpeed: 1.2 }), "current");
assert.equal(currentness({ timing: "blocked" }), "current");
assert.equal(currentness({ index: 12 }), "current");
assert.equal(currentness({ count: 12 }), "current");

assert.equal(currentness({}, { spokenText: "Narration changed." }), "stale");
assert.equal(currentness({ voiceId: "voice-b", identity: "documentary-narrator:voice-b" }), "stale");
assert.equal(currentness({ profile: "warm", identity: "warm-narrator:voice-a" }), "stale");
assert.equal(currentness({ model: "eleven_turbo_v2_5" }), "stale");
assert.equal(currentness({ stability: 0.65 }), "stale");
assert.equal(currentness({ similarityBoost: 0.6 }), "stale");
assert.equal(currentness({ style: 0.3 }), "stale");
assert.equal(currentness({ userSpeed: 0.9 }), "stale");
assert.equal(currentness({ quality: "cinematic" }), "stale");
assert.equal(currentness({ format: "short_form" }), "stale");
assert.equal(currentness({ strategy: "standard_narration" }), "stale");
assert.equal(currentness({}, { audioUrl: "" }), "missing");
assert.equal(currentness(), "current", "exact restoration remains current");

const dialogueSettings = settingsKey({
  role: "dialogue",
  profile: "character-a:voice-a|Speaker:fallback",
  identity: "character-a-dialogue:voice-a",
});
const dialogueCurrentness = (spokenText, sourceText, input = {}) => deriveCreatorAudioCurrentness({
  spokenText,
  audioUrl: "https://assets.test/dialogue.mp3",
  sourceText,
  settingsKey: dialogueSettings,
  currentSettingsKey: settingsKey({
    role: "dialogue",
    profile: "character-a:voice-a|Speaker:fallback",
    identity: "character-a-dialogue:voice-a",
    ...input,
  }),
});
assert.equal(dialogueCurrentness("Speaker: Hello.", "Speaker: Hello.", { index: 8, count: 20 }), "current");
assert.equal(dialogueCurrentness("Speaker: Changed.", "Speaker: Hello."), "stale");
assert.equal(currentness(), "current", "dialogue changes do not stale narration");

const ids = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
];
const scenes = ids.map((creatorSceneId, index) => ({
  id: index + 1,
  creatorSceneId,
  narration,
  audioUrl: `https://assets.test/${index + 1}.mp3`,
  audioSourceText: narration,
  audioSettingsKey: settingsKey({ index, count: 3 }),
}));
const afterDelete = removeCreatorScene(scenes, ids[1]).scenes;
assert.equal(afterDelete[0].creatorSceneId, ids[0]);
assert.equal(afterDelete[1].creatorSceneId, ids[2]);
assert.equal(deriveCreatorAudioCurrentness({
  spokenText: afterDelete[1].narration,
  audioUrl: afterDelete[1].audioUrl,
  sourceText: afterDelete[1].audioSourceText,
  settingsKey: afterDelete[1].audioSettingsKey,
  currentSettingsKey: settingsKey({ index: 1, count: 2 }),
}), "current", "deleting another scene cannot stale untouched voice");
const reordered = moveCreatorScene(scenes, ids[2], "earlier");
assert.equal(deriveCreatorAudioCurrentness({
  spokenText: reordered[1].narration,
  audioUrl: reordered[1].audioUrl,
  sourceText: reordered[1].audioSourceText,
  settingsKey: reordered[1].audioSettingsKey,
  currentSettingsKey: settingsKey({ index: 1, count: 3 }),
}), "current", "reordering cannot stale untouched voice");

const page = readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const helper = readFileSync(new URL("../lib/creator/editorState.ts", import.meta.url), "utf8");
assert.match(page, /const getSceneAudioStatus[\s\S]*deriveCreatorAudioCurrentness/);
assert.doesNotMatch(page.slice(page.indexOf("const getSceneAudioStatus"), page.indexOf("const getSceneDialogueAudioStatus")), /audioSettingsKey === currentSettingsKey/);
assert.match(page.slice(page.indexOf("const getSceneAudioUrl"), page.indexOf("const generateSceneAudio")), /deriveCreatorAudioCurrentness/);
assert.match(page.slice(page.indexOf("const getSceneDialogueUrl"), page.indexOf("const generateSceneDialogueAudio")), /deriveCreatorAudioCurrentness/);
assert.doesNotMatch(page, /(?:audioSettingsKey|dialogueAudioSettingsKey) === currentSettingsKey/);
assert.match(helper, /timing-volatile[\s\S]*speed-volatile[\s\S]*status-volatile[\s\S]*index-volatile[\s\S]*count-volatile/);
assert.doesNotMatch(helper, /fetch\(|provider|store-audio|reserveMeteredOperation|settleMeteredOperation/i);

console.log("STAGE_0_18A2_VOICE_CURRENTNESS_STABILITY=PASS");
