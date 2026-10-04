import assert from "node:assert/strict";
import fs from "node:fs";

import {
  createCreatorScriptBuildSectionLengthRecoveryBand,
  validateCreatorScriptBuildGeneratedSectionLength,
} from "../lib/creator/creatorScriptBuildSectionGenerationGuard.ts";

const budget = {
  id: "section-1",
  kind: "body",
  role: "status",
  centralQuestion: "What happens to status?",
  progression: "work to status",
  ownershipBoundary: {
    usage: "control_only_never_narrate",
    owns: ["approved_theme:status"],
    excludes: [],
  },
  minimumWords: 285,
  targetWords: 317,
  maximumWords: 349,
};

function words(count) {
  return Array.from({ length: count }, (_, index) => `word${index + 1}`).join(" ");
}

const tooShort = validateCreatorScriptBuildGeneratedSectionLength({
  value: { text: words(277) },
  budget,
});
assert.equal(tooShort.reason, "below_minimum");
assert.deepEqual(
  createCreatorScriptBuildSectionLengthRecoveryBand(tooShort),
  { minimumWords: 317, maximumWords: 349 },
);

const tooLong = validateCreatorScriptBuildGeneratedSectionLength({
  value: { text: words(381) },
  budget,
});
assert.equal(tooLong.reason, "above_maximum");
assert.deepEqual(
  createCreatorScriptBuildSectionLengthRecoveryBand(tooLong),
  { minimumWords: 285, maximumWords: 317 },
);

const accepted = validateCreatorScriptBuildGeneratedSectionLength({
  value: { text: words(317) },
  budget,
});
assert.equal(accepted.reason, "accepted");
assert.deepEqual(
  createCreatorScriptBuildSectionLengthRecoveryBand(accepted),
  { minimumWords: 285, maximumWords: 349 },
);

const provider = fs.readFileSync(
  new URL("../lib/creator/creatorScriptBuildProviders.server.ts", import.meta.url),
  "utf8",
);
assert.match(provider, /recoveryMinimumWords/u);
assert.match(provider, /recoveryMaximumWords/u);
assert.match(provider, /Do not aim at the failed boundary/u);

console.log("stage-0-19f-f17-section-generation-recovery-band-test: PASS");
