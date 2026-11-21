import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CREATOR_LONG_FORM_AUTOMATIC_MAX_SPEED,
  getCreatorRoutedVoiceSettings,
  getCreatorVoiceRoute,
} from "../lib/creator/voiceRouting.ts";
import { getCreatorVoiceSelection } from "../lib/creator/voiceProfiles.ts";
import { deriveCreatorAudioCurrentness } from "../lib/creator/editorState.ts";

const words = (count) => Array.from({ length: count }, (_, index) => `word${index + 1}`).join(" ");
const route = (wordCount, overrides = {}) => getCreatorVoiceRoute({
  qualityMode: "pro",
  format: "youtube_video",
  role: "narrator",
  language: "en",
  text: words(wordCount),
  targetSceneDurationSec: 10,
  sceneIndex: 0,
  sceneCount: 20,
  voiceProfile: "faceless narrator",
  ...overrides,
});

const normal = route(10);
const overfull = route(23);
const veryOverfull = route(60);
const clearProfile = getCreatorVoiceSelection("velto_clear");
const authoritativeProfile = getCreatorVoiceSelection("velto_authoritative");

assert.equal(CREATOR_LONG_FORM_AUTOMATIC_MAX_SPEED, 0.95);
assert.ok(normal.recommendedSpeed <= 0.95);
assert.equal(getCreatorRoutedVoiceSettings({ route: normal, settings: clearProfile.settings }).speed, 0.95);
assert.equal(overfull.timingStatus, "blocked");
assert.equal(overfull.recommendedSpeed, 0.95, "timing pressure must not accelerate narration");
assert.equal(veryOverfull.timingStatus, "blocked");
assert.equal(veryOverfull.recommendedSpeed, 0.95, "extreme timing pressure must not approach 1.2");
assert.equal(overfull.canGenerate, true, "non-draft overfull narration remains generatable");
assert.match(overfull.warning, /extend or split/i);
assert.doesNotMatch(overfull.warning, /accelerat|speed up|smart pacing/i);
assert.equal(
  getCreatorRoutedVoiceSettings({ route: normal, settings: authoritativeProfile.settings }).speed,
  0.93,
  "slower profile intent must remain slower",
);
assert.equal(
  getCreatorRoutedVoiceSettings({
    route: overfull,
    settings: { ...clearProfile.settings, speed: 1.05 },
    allowExplicitSpeedOverride: true,
  }).speed,
  1.05,
  "advanced explicit speed remains authoritative",
);

const shortForm = route(10, { format: "short_form" });
assert.equal(shortForm.recommendedSpeed, 1.02);
assert.equal(
  getCreatorRoutedVoiceSettings({ route: shortForm, settings: getCreatorVoiceSelection("velto_energetic").settings }).speed,
  1.07,
  "short-form retains intentionally faster profile pacing",
);

const settingsKey = (routeSpeed) =>
  `voice-model-0.5-0.8-0.2-1-creator-voice-v1:pro:youtube_video:narrator:faceless_narrator:professional:10:${routeSpeed}:safe:0:20:fallback-profile`;
assert.equal(deriveCreatorAudioCurrentness({
  spokenText: "same narration",
  audioUrl: "https://assets.test/narration.mp3",
  sourceText: "same narration",
  settingsKey: settingsKey(1.2),
  currentSettingsKey: settingsKey(0.95),
}), "stale", "effective route speed changes must invalidate generated audio");

const narratorRouteSource = readFileSync(new URL("../app/api/store-audio/route.ts", import.meta.url), "utf8");
const dialogueRouteSource = readFileSync(new URL("../app/api/store-dialogue-audio/route.ts", import.meta.url), "utf8");
const adapterSource = readFileSync(new URL("../lib/providers/voice/elevenLabsVoiceAdapter.ts", import.meta.url), "utf8");
const routingSource = readFileSync(new URL("../lib/creator/voiceRouting.ts", import.meta.url), "utf8");
for (const source of [narratorRouteSource, dialogueRouteSource]) {
  assert.match(source, /const isCreatorLab = body\?\.productProfile === "creatorlab"/);
  assert.match(source, /isCreatorLab[\s\S]*getCreatorVoiceRoute/);
  assert.match(source, /allowExplicitSpeedOverride/);
}
assert.match(adapterSource, /speed: input\.settings\.speed/);
assert.doesNotMatch(routingSource + narratorRouteSource + dialogueRouteSource + adapterSource, /\batempo\b/);

console.log("Stage 0.20B1 natural voice pace authority passed.");
console.log(JSON.stringify({
  normal: { estimatedSpeechSeconds: normal.estimatedSpeechSeconds, targetSceneDurationSec: normal.targetSceneDurationSec, timingStatus: normal.timingStatus, effectiveSpeed: getCreatorRoutedVoiceSettings({ route: normal, settings: clearProfile.settings }).speed },
  overfull: { estimatedSpeechSeconds: overfull.estimatedSpeechSeconds, targetSceneDurationSec: overfull.targetSceneDurationSec, timingStatus: overfull.timingStatus, effectiveSpeed: getCreatorRoutedVoiceSettings({ route: overfull, settings: clearProfile.settings }).speed },
  veryOverfull: { estimatedSpeechSeconds: veryOverfull.estimatedSpeechSeconds, targetSceneDurationSec: veryOverfull.targetSceneDurationSec, timingStatus: veryOverfull.timingStatus, effectiveSpeed: getCreatorRoutedVoiceSettings({ route: veryOverfull, settings: clearProfile.settings }).speed },
  shortForm: { recommendedSpeed: shortForm.recommendedSpeed, effectiveSpeed: getCreatorRoutedVoiceSettings({ route: shortForm, settings: getCreatorVoiceSelection("velto_energetic").settings }).speed },
}, null, 2));
