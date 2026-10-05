import assert from "node:assert/strict";
import fs from "node:fs";

import {
  getCreatorScriptBuildSectionContinuationSegmentMaximumWords,
  selectCreatorScriptBuildSectionContinuationPrefix,
} from "../lib/creator/creatorScriptBuildSectionGenerationGuard.ts";

const words = (count, prefix) =>
  Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`).join(" ");
const sentence = (count, prefix) => `${words(count, prefix)}.`;

const budget = {
  id: "opening",
  kind: "opening",
  role: "hook",
  centralQuestion: "What changes if work becomes optional?",
  progression: "opening tension",
  ownershipBoundary: {
    usage: "control_only_never_narrate",
    owns: ["opening_tension"],
    excludes: ["later_synthesis"],
  },
  minimumWords: 285,
  targetWords: 317,
  maximumWords: 349,
};

const initial = {
  heading: null,
  text: sentence(278, "initial"),
  claimIds: ["claim-initial"],
};

// Exact F20.1 live failure class: the first continuation segment alone crosses
// the final hard maximum, so no safe prefix can be retained.
const overshoot = selectCreatorScriptBuildSectionContinuationPrefix({
  previous: initial,
  continuation: {
    segments: [
      { text: sentence(80, "overshoot"), claimIds: ["claim-overshoot"] },
    ],
  },
  budget,
});
assert.equal(overshoot.accepted, false);
assert.equal(overshoot.reason, "above_maximum");
assert.equal(overshoot.retainedSegmentCount, 0);

// F20.2 constrains corrective continuation sentences to short atomic units.
// A fresh bounded continuation can then yield a valid ordered prefix without
// rewriting or truncating the grounded initial candidate.
assert.equal(
  getCreatorScriptBuildSectionContinuationSegmentMaximumWords(71),
  24,
);
assert.equal(
  getCreatorScriptBuildSectionContinuationSegmentMaximumWords(18),
  18,
);
assert.equal(
  getCreatorScriptBuildSectionContinuationSegmentMaximumWords(0),
  null,
);

const corrected = selectCreatorScriptBuildSectionContinuationPrefix({
  previous: initial,
  continuation: {
    segments: [
      { text: sentence(20, "correctedA"), claimIds: ["claim-a"] },
      { text: sentence(20, "correctedB"), claimIds: ["claim-b"] },
    ],
  },
  budget,
});
assert.equal(corrected.accepted, true);
assert.equal(corrected.retainedSegmentCount, 2);
assert.equal(corrected.value.text.startsWith(initial.text), true);
assert.deepEqual(corrected.value.claimIds, [
  "claim-initial",
  "claim-a",
  "claim-b",
]);

const provider = fs.readFileSync(
  new URL("../lib/creator/creatorScriptBuildProviders.server.ts", import.meta.url),
  "utf8",
);
assert.match(provider, /continuationSegmentMaximumWords is a hard per-segment spoken-word ceiling/u);
assert.match(provider, /zero_retained_prefix_above_maximum/u);
assert.match(provider, /length-retry:2:prefix-recovery:1/u);
assert.match(
  provider,
  /prefix\.reason === "above_maximum"[\s\S]*prefix\.retainedSegmentCount === 0/u,
);
assert.match(provider, /prefixRecoveryAttempts = 1/u);
assert.match(provider, /continuationCorrection/u);

console.log("stage-0-19f-f20-2-zero-prefix-continuation-recovery-test: PASS");
