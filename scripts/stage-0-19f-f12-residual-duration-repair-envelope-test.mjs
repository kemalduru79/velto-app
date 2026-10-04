import assert from "node:assert/strict";

import {
  CREATOR_SCRIPT_MAX_RESIDUAL_REPAIR_RATIO,
  getCreatorScriptDurationContract,
  isCreatorScriptResidualRepairEligible,
} from "../lib/creator/creatorScript.ts";

assert.equal(CREATOR_SCRIPT_MAX_RESIDUAL_REPAIR_RATIO, 0.15);

const liveRun = getCreatorScriptDurationContract({
  targetDurationSec: 660,
  language: "en",
  actualWordCount: 1177,
});

assert.equal(liveRun.status, "too_short");
assert.equal(liveRun.targetWordCount, 1551);
assert.equal(liveRun.minimumAcceptableWordCount, 1396);
assert.equal(
  isCreatorScriptResidualRepairEligible(liveRun),
  true,
  "the live F10 acceptance draft should remain eligible for bounded repair",
);

const materiallyTooShort = getCreatorScriptDurationContract({
  targetDurationSec: 660,
  language: "en",
  actualWordCount: 1100,
});

assert.equal(materiallyTooShort.status, "too_short");
assert.equal(
  isCreatorScriptResidualRepairEligible(materiallyTooShort),
  false,
  "materially larger duration misses must still fail closed instead of expanding repair scope",
);

console.log("stage-0-19f-f12-residual-duration-repair-envelope-test: PASS");
