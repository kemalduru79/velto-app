import assert from "node:assert/strict";

import {
  applyCreatorSceneScriptFitResult,
  runCreatorSceneScriptFitOnce,
  validateCreatorSceneScriptFit,
} from "../lib/creator/sceneScriptFit.ts";
import { matchAudioDurationToScene } from "../lib/video/audioDurationMatching.ts";

const draft = (words) => ({ narration: words, dialogue: "" });
const words = (count, prefix = "detail") =>
  Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`).join(" ");
const validate = (original, candidate, overrides = {}) =>
  validateCreatorSceneScriptFit({
    original: draft(original),
    candidate: draft(candidate),
    language: "en",
    targetDurationSec: 10,
    minWords: 10,
    targetWords: 16,
    maxWords: 20,
    ...overrides,
  });

const healthy = validate(words(16), words(14));
assert.equal(healthy.state, "accepted");
assert.equal(healthy.reason, "FIT_ACCEPTED");
assert.ok(healthy.estimatedSpeechSec > 0);
assert.equal(healthy.minWords, 10, "the general script-health minimum remains unchanged");
assert.equal(healthy.acceptanceMinWords, 14, "Autofit derives a stricter floor from the target budget");

const oldMinimumOccupancy = validate(words(16), words(10));
assert.equal(oldMinimumOccupancy.state, "rejected");
assert.equal(oldMinimumOccupancy.reason, "MATERIALLY_UNDERFILLED");
assert.equal(validate(words(16), words(16)).state, "accepted", "near-target narration is healthy");
assert.equal(validate(words(16), words(14)).state, "accepted", "modest under-target narration remains healthy");
assert.equal(validate(words(18), words(18)).state, "accepted", "modest over-target narration remains healthy");

assert.equal(validate(words(16), "").reason, "EMPTY_OUTPUT");
assert.equal(validate(words(16), words(5)).reason, "BELOW_MINIMUM_WORDS");
assert.equal(validate(words(15), words(25)).reason, "ABOVE_MAXIMUM_WORDS");
assert.equal(
  validate(words(15), words(19), { targetDurationSec: 8, maxWords: 30 }).state,
  "rejected",
  "output above the existing target-minus-buffer speech window must not be accepted",
);

const strongOriginal = draft(words(30, "fact"));
const trivialCandidate = validateCreatorSceneScriptFit({
  original: strongOriginal,
  candidate: draft(words(14, "summary")),
  language: "en",
  targetDurationSec: 10,
  minWords: 10,
  targetWords: 16,
  maxWords: 20,
});
assert.equal(trivialCandidate.reason, "CONTENT_RETENTION_TOO_LOW");
assert.deepEqual(
  applyCreatorSceneScriptFitResult(strongOriginal, trivialCandidate),
  strongOriginal,
  "a rejected model result must preserve the original draft by identity and value",
);
assert.deepEqual(
  applyCreatorSceneScriptFitResult(strongOriginal, healthy),
  { narration: healthy.narration, dialogue: healthy.dialogue },
  "only an accepted result may replace the draft",
);

const anchoredOriginal = "In 2024 revenue reached 37% after the audited launch delivered stable regional growth across all markets";
const missingAnchor = "The annual revenue increased after the audited launch delivered stable regional growth across all major markets";
assert.equal(validate(anchoredOriginal, missingAnchor).reason, "FACTUAL_ANCHOR_MISSING");

const extension = validate(words(30), words(24));
assert.equal(extension.state, "extend_duration");
assert.equal(extension.reason, "DURATION_EXTENSION_RECOMMENDED");
assert.ok(extension.suggestedDurationSec > extension.targetDurationSec);
assert.ok(extension.suggestedDurationSec <= 20);

const split = validate(words(60), words(45));
assert.equal(split.state, "split_recommended");
assert.equal(split.reason, "SCENE_SPLIT_RECOMMENDED");
assert.ok(split.recommendedSplitCount >= 2);

let modelCalls = 0;
let economicsCalls = 0;
let validationCalls = 0;
const once = await runCreatorSceneScriptFitOnce({
  generate: async () => {
    modelCalls += 1;
    return { output: words(14) };
  },
  recordEconomics: async () => {
    economicsCalls += 1;
  },
  validate: (response) => {
    validationCalls += 1;
    return validate(words(16), response.output);
  },
});
assert.equal(once.state, "accepted");
assert.equal(modelCalls, 1, "Autofit permits exactly one generation call");
assert.equal(economicsCalls, 1, "the consumed generation is recorded before validation returns");
assert.equal(validationCalls, 1);

let failedProviderEconomics = 0;
await assert.rejects(
  runCreatorSceneScriptFitOnce({
    generate: async () => {
      throw new Error("provider unavailable");
    },
    recordEconomics: async () => {
      failedProviderEconomics += 1;
    },
    validate: () => healthy,
  }),
  /provider unavailable/,
);
assert.equal(failedProviderEconomics, 0, "provider failures remain fail closed and cannot fabricate usage responses");

const measuredTiming = matchAudioDurationToScene({
  audioDurationSec: 6,
  plannedDurationSec: 10,
  minDurationSec: 3,
  maxDurationSec: 30,
  preferredMaxSceneDurationSec: 20,
  tailBufferSec: 0.75,
});
assert.equal(measuredTiming.status, "shortened");
assert.equal(measuredTiming.targetDurationSec, 6.75);

console.log("Stage 0.10H Autofit hardening tests passed.");
