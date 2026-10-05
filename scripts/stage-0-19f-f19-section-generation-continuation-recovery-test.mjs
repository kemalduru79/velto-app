import assert from "node:assert/strict";
import fs from "node:fs";

import {
  createCreatorScriptBuildSectionContinuationBand,
  getCreatorScriptBuildSectionContinuationMaxOutputTokens,
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
const result = await runCreatorScriptBuildSectionGenerationWithBoundedRetry({
  budget,
  execute: async (recovery) => {
    calls.push(recovery);
    return recovery.ordinal === 1
      ? { heading: "Evidence", text: words(281), claimIds: ["claim-1"] }
      : {
          heading: "Evidence",
          text: `${words(281)} ${words(36, "continuation")}`,
          claimIds: ["claim-1"],
        };
  },
});
assert.equal(calls.length, 2);
assert.equal(result.attempts, 2);
assert.equal(result.validation.accepted, true);
assert.equal(result.validation.wordCount, 317);

const overfilled = await runCreatorScriptBuildSectionGenerationWithBoundedRetry({
  budget,
  execute: async ({ ordinal }) => ({
    heading: "Evidence",
    text: ordinal === 1
      ? words(281)
      : `${words(281)} ${words(69, "continuation")}`,
    claimIds: ["claim-1"],
  }),
});
assert.equal(overfilled.attempts, 2);
assert.equal(overfilled.validation.accepted, false);
assert.equal(overfilled.validation.reason, "above_maximum");
assert.equal(overfilled.validation.wordCount, 350);

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
assert.match(provider, /mergeSectionContinuation/u);
assert.match(provider, /getCreatorScriptBuildSectionContinuationMaxOutputTokens/u);
assert.match(provider, /length-retry:2/u);

console.log("stage-0-19f-f19-section-generation-continuation-recovery-test: PASS");
