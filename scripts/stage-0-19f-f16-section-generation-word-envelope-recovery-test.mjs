import assert from "node:assert/strict";
import fs from "node:fs";

import {
  runCreatorScriptBuildSectionGenerationWithBoundedRetry,
  validateCreatorScriptBuildGeneratedSectionLength,
} from "../lib/creator/creatorScriptBuildSectionGenerationGuard.ts";

const budget = {
  id: "section-2",
  kind: "body",
  role: "money",
  centralQuestion: "What happens to money?",
  progression: "status to money",
  ownershipBoundary: {
    usage: "control_only_never_narrate",
    owns: ["approved_theme:money"],
    excludes: [],
  },
  minimumWords: 285,
  targetWords: 317,
  maximumWords: 349,
};

function words(count) {
  return Array.from({ length: count }, (_, index) => `word${index + 1}`).join(" ");
}

assert.equal(
  validateCreatorScriptBuildGeneratedSectionLength({
    value: { text: words(184) },
    budget,
  }).reason,
  "below_minimum",
);
assert.equal(
  validateCreatorScriptBuildGeneratedSectionLength({
    value: { text: words(400) },
    budget,
  }).reason,
  "above_maximum",
);
assert.equal(
  validateCreatorScriptBuildGeneratedSectionLength({
    value: { text: words(317) },
    budget,
  }).reason,
  "accepted",
);

{
  const calls = [];
  const result = await runCreatorScriptBuildSectionGenerationWithBoundedRetry({
    budget,
    execute: async (recovery) => {
      calls.push(recovery);
      return { text: words(317) };
    },
  });
  assert.equal(result.attempts, 1);
  assert.equal(result.validation.accepted, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].previousValidation, null);
}

{
  const calls = [];
  const result = await runCreatorScriptBuildSectionGenerationWithBoundedRetry({
    budget,
    execute: async (recovery) => {
      calls.push(recovery);
      return recovery.ordinal === 1
        ? { text: words(158) }
        : { text: words(317) };
    },
  });
  assert.equal(result.attempts, 2);
  assert.equal(result.validation.accepted, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].previousValidation.reason, "below_minimum");
  assert.equal(calls[1].previousValidation.wordCount, 158);
}

{
  let calls = 0;
  const result = await runCreatorScriptBuildSectionGenerationWithBoundedRetry({
    budget,
    execute: async ({ ordinal }) => {
      calls += 1;
      return { text: words(ordinal === 1 ? 184 : 202) };
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.attempts, 2);
  assert.equal(result.validation.accepted, false);
  assert.equal(result.validation.reason, "below_minimum");
  assert.equal(result.validation.wordCount, 202);
}

const provider = fs.readFileSync(
  new URL("../lib/creator/creatorScriptBuildProviders.server.ts", import.meta.url),
  "utf8",
);
assert.match(provider, /sectionLengthRecovery/u);
assert.match(provider, /length-retry:2/u);
assert.match(
  provider,
  /CREATOR_SCRIPT_BUILD_GENERATED_SECTION_WORD_BUDGET_INVALID/u,
);
assert.match(
  provider,
  /runCreatorScriptBuildSectionGenerationWithBoundedRetry/u,
);

console.log("stage-0-19f-f16-section-generation-word-envelope-recovery-test: PASS");
