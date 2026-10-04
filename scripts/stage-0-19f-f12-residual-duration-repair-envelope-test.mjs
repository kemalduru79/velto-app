import assert from "node:assert/strict";

import {
  CREATOR_SCRIPT_MAX_LONG_FORM_RESIDUAL_REPAIR_RATIO,
  CREATOR_SCRIPT_MAX_RESIDUAL_REPAIR_RATIO,
  getCreatorScriptDurationContract,
  isCreatorScriptResidualRepairEligible,
} from "../lib/creator/creatorScript.ts";

assert.equal(CREATOR_SCRIPT_MAX_RESIDUAL_REPAIR_RATIO, 0.12);
assert.equal(CREATOR_SCRIPT_MAX_LONG_FORM_RESIDUAL_REPAIR_RATIO, 0.15);

const liveLongForm = getCreatorScriptDurationContract({
  targetDurationSec: 660,
  language: "en",
  actualWordCount: 1177,
});

assert.equal(liveLongForm.status, "too_short");
assert.equal(liveLongForm.targetWordCount, 1551);
assert.equal(liveLongForm.minimumAcceptableWordCount, 1396);
assert.equal(
  isCreatorScriptResidualRepairEligible(liveLongForm),
  true,
  "the live section-native long-form draft should remain eligible for bounded repair",
);

const materiallyTooShortLongForm = getCreatorScriptDurationContract({
  targetDurationSec: 660,
  language: "en",
  actualWordCount: 1100,
});

assert.equal(
  isCreatorScriptResidualRepairEligible(materiallyTooShortLongForm),
  false,
  "larger long-form misses must still fail closed",
);

const shortForm = getCreatorScriptDurationContract({
  targetDurationSec: 120,
  language: "en",
  actualWordCount: 214,
});

assert.equal(shortForm.targetWordCount, 282);
assert.equal(shortForm.minimumAcceptableWordCount, 254);
assert.equal(shortForm.status, "too_short");
assert.equal(
  isCreatorScriptResidualRepairEligible(shortForm),
  false,
  "the existing short-form 12 percent safety envelope must remain unchanged",
);

console.log("stage-0-19f-f12-residual-duration-repair-envelope-test: PASS");
