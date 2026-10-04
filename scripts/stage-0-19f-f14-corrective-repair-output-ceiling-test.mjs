import assert from "node:assert/strict";
import fs from "node:fs";

import {
  getCreatorScriptBuildRepairCorrectiveMaxOutputTokens,
} from "../lib/creator/creatorScriptBuildProviders.server.ts";

const target = {
  sectionId: "section-4",
  strategy: "expand",
  direction: "expand",
  beforeWords: 218,
  requiredFinalMinWords: 285,
  requiredFinalTargetWords: 317,
  requiredFinalMaxWords: 349,
  minimumRequiredGain: 67,
  minimumRequiredReduction: 0,
};

assert.equal(
  getCreatorScriptBuildRepairCorrectiveMaxOutputTokens({
    mode: "replacement",
    candidate: {
      buildId: "build",
      sectionId: "section-4",
      ordinal: 1,
      rejectionFeedback: null,
    },
    replacementTargets: [target],
  }),
  null,
  "the first replacement candidate must keep the existing provider budget",
);

assert.equal(
  getCreatorScriptBuildRepairCorrectiveMaxOutputTokens({
    mode: "replacement",
    candidate: {
      buildId: "build",
      sectionId: "section-4",
      ordinal: 2,
      rejectionFeedback: {
        accepted: false,
        reason: "above_maximum",
        sectionId: "section-4",
        beforeWords: 218,
        candidateWords: 412,
        minimumWords: 285,
        maximumWords: 349,
      },
    },
    replacementTargets: [target],
  }),
  824,
  "a rejected long replacement retry must receive a server-owned output ceiling",
);

assert.equal(
  getCreatorScriptBuildRepairCorrectiveMaxOutputTokens({
    mode: "additive",
    candidate: null,
    replacementTargets: [],
  }),
  null,
);

const source = fs.readFileSync(
  new URL("../lib/creator/creatorScriptBuildProviders.server.ts", import.meta.url),
  "utf8",
);
assert.match(source, /max_output_tokens/u);
assert.match(source, /getCreatorScriptBuildRepairCorrectiveMaxOutputTokens\(value\)/u);

console.log("stage-0-19f-f14-corrective-repair-output-ceiling-test: PASS");
