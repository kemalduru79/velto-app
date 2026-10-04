import assert from "node:assert/strict";
import fs from "node:fs";

import {
  getCreatorScriptBuildRepairCorrectiveMaxOutputTokens,
} from "../lib/creator/creatorScriptBuildRepairOutputBudget.ts";

assert.equal(
  getCreatorScriptBuildRepairCorrectiveMaxOutputTokens({
    mode: "replacement",
    candidateOrdinal: 1,
    requiredFinalMaxWords: 349,
  }),
  null,
  "the first replacement candidate must keep the existing provider budget",
);

assert.equal(
  getCreatorScriptBuildRepairCorrectiveMaxOutputTokens({
    mode: "replacement",
    candidateOrdinal: 2,
    requiredFinalMaxWords: 349,
  }),
  824,
  "a rejected long replacement retry must receive a server-owned output ceiling",
);

assert.equal(
  getCreatorScriptBuildRepairCorrectiveMaxOutputTokens({
    mode: "additive",
    candidateOrdinal: null,
    requiredFinalMaxWords: null,
  }),
  null,
);

const source = fs.readFileSync(
  new URL("../lib/creator/creatorScriptBuildProviders.server.ts", import.meta.url),
  "utf8",
);
assert.match(source, /max_output_tokens/u);
assert.match(source, /getCreatorScriptBuildRepairCorrectiveMaxOutputTokens/u);
assert.match(source, /candidateOrdinal: value\.candidate\?\.ordinal/u);

console.log("stage-0-19f-f14-corrective-repair-output-ceiling-test: PASS");
