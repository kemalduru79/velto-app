import assert from "node:assert/strict";
import fs from "node:fs";

import {
  createCreatorScriptBuildSectionContinuationBand,
  creatorScriptBuildSectionContinuationIntroducesLocalRepetition,
  getCreatorScriptBuildSectionContinuationMaxOutputTokens,
  mergeCreatorScriptBuildSectionContinuation,
  runCreatorScriptBuildSectionGenerationWithBoundedRetry,
  validateCreatorScriptBuildGeneratedSectionLength,
} from "../lib/creator/creatorScriptBuildSectionGenerationGuard.ts";

const budget = {
  id: "section-3",
  kind: "body",
  role: "evidence",
  centralQuestion: "What does the evidence show?",
  progression: "mechanism to evidence",
  ownershipBoundary: {
    usage: "control_only_never_narrate",
    owns: ["grounded_demonstration"],
    excludes: [],
  },
  minimumWords: 285,
  targetWords: 317,
  maximumWords: 349,
};

const words = (count, prefix = "word") =>
  Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`).join(" ");

const liveReplacement = validateCreatorScriptBuildGeneratedSectionLength({
  value: { text: words(281) },
  budget,
});
assert.equal(liveReplacement.accepted, false);
assert.equal(liveReplacement.reason, "below_minimum");
assert.deepEqual(
  createCreatorScriptBuildSectionContinuationBand(liveReplacement),
  { minimumWords: 36, maximumWords: 68 },
);
assert.equal(
  getCreatorScriptBuildSectionContinuationMaxOutputTokens(68),
  332,
);

const calls = [];
const initialCandidate = {
  heading: "Evidence",
  text: words(281),
  claimIds: ["claim-1"],
};
const continuation = {
  text: words(36, "continuation"),
  claimIds: ["claim-2"],
};
const initialSnapshot = structuredClone(initialCandidate);
const mergedLiveCase = mergeCreatorScriptBuildSectionContinuation(
  initialCandidate,
  continuation,
);
assert.deepEqual(
  initialCandidate,
  initialSnapshot,
  "merge must not mutate the grounded initial candidate",
);
assert.equal(
  mergedLiveCase.text.startsWith(initialCandidate.text),
  true,
  "merge must preserve the initial candidate text as the exact prefix",
);
assert.deepEqual(mergedLiveCase.claimIds, ["claim-1", "claim-2"]);
assert.equal(
  creatorScriptBuildSectionContinuationIntroducesLocalRepetition({
    previous: initialCandidate,
    continuation,
  }),
  false,
);

const result = await runCreatorScriptBuildSectionGenerationWithBoundedRetry({
  budget,
  execute: async (recovery) => {
    calls.push(recovery);
    return recovery.ordinal === 1
      ? initialCandidate
      : mergedLiveCase;
  },
});
assert.equal(calls.length, 2);
assert.equal(result.attempts, 2);
assert.equal(result.validation.accepted, true);
assert.equal(result.validation.wordCount, 317);

const overfilled = await runCreatorScriptBuildSectionGenerationWithBoundedRetry({
  budget,
  execute: async ({ ordinal }) =>
    ordinal === 1
      ? initialCandidate
      : mergeCreatorScriptBuildSectionContinuation(initialCandidate, {
          text: words(69, "continuation"),
          claimIds: [],
        }),
});
assert.equal(overfilled.attempts, 2);
assert.equal(overfilled.validation.accepted, false);
assert.equal(overfilled.validation.reason, "above_maximum");
assert.equal(overfilled.validation.wordCount, 350);

assert.equal(
  creatorScriptBuildSectionContinuationIntroducesLocalRepetition({
    previous: {
      text: "This tension shows why status can migrate outside paid work.",
    },
    continuation: {
      text: "This tension shows why status can migrate into new scoreboards.",
    },
  }),
  true,
  "continuation must reuse the existing F10 local-repetition guard",
);

const provider = fs.readFileSync(
  new URL("../lib/creator/creatorScriptBuildProviders.server.ts", import.meta.url),
  "utf8",
);
assert.match(provider, /SECTION_NATIVE_CONTINUATION_SYSTEM/u);
assert.doesNotMatch(
  provider,
  /const SECTION_NATIVE_CONTINUATION_SYSTEM = \[\s*SECTION_NATIVE_GENERATION_SYSTEM/u,
);
assert.match(provider, /preserve previousCandidate exactly/u);
assert.match(provider, /whitespace-separated narration words, not model tokens/u);
assert.match(provider, /generationSectionContinuationSchema/u);
assert.match(provider, /selectCreatorScriptBuildSectionContinuationPrefix/u);
assert.match(
  provider,
  /CREATOR_SCRIPT_BUILD_GENERATED_SECTION_CONTINUATION_LOCAL_REPETITION/u,
);
assert.match(provider, /getCreatorScriptBuildSectionContinuationMaxOutputTokens/u);
assert.match(provider, /length-retry:2/u);

console.log("stage-0-19f-f19-section-generation-continuation-recovery-test: PASS");
