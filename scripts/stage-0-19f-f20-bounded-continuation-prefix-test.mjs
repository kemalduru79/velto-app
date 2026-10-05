import assert from "node:assert/strict";
import fs from "node:fs";

import {
  createCreatorScriptBuildSectionContinuationBand,
  createCreatorScriptBuildSectionLengthRecoveryBand,
  selectCreatorScriptBuildSectionContinuationPrefix,
  validateCreatorScriptBuildGeneratedSectionLength,
} from "../lib/creator/creatorScriptBuildSectionGenerationGuard.ts";

const words = (count, prefix) =>
  Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`).join(" ");
const sentence = (count, prefix) => `${words(count, prefix)}.`;
const budget = {
  id: "section-4",
  kind: "body",
  role: "limits",
  centralQuestion: "What limits remain?",
  progression: "evidence to limits",
  ownershipBoundary: {
    usage: "control_only_never_narrate",
    owns: ["limits"],
    excludes: ["mechanism"],
  },
  minimumWords: 285,
  targetWords: 317,
  maximumWords: 349,
};

// Exact live terminal shape: the opaque merge reached 378 words. Atomic units
// let the server retain the maximal safe 338-word prefix instead.
const initial = {
  heading: "Limits",
  text: sentence(278, "initial"),
  claimIds: ["claim-initial"],
};
const initialSnapshot = structuredClone(initial);
const continuation = {
  segments: [
    { text: sentence(30, "first"), claimIds: ["claim-retained-a"] },
    { text: sentence(30, "second"), claimIds: ["claim-retained-b"] },
    { text: sentence(40, "discarded"), claimIds: ["claim-discarded"] },
  ],
};
assert.equal(
  278 + continuation.segments.reduce(
    (total, segment) => total + segment.text.trim().split(/\s+/u).length,
    0,
  ),
  378,
);
const recovered = selectCreatorScriptBuildSectionContinuationPrefix({
  previous: initial,
  continuation,
  budget,
});
assert.equal(recovered.accepted, true);
assert.equal(recovered.retainedSegmentCount, 2);
assert.deepEqual(initial, initialSnapshot, "initial candidate must be immutable");
assert.equal(recovered.value.text.startsWith(initial.text), true);
assert.equal(recovered.value.text.endsWith("."), true);
assert.deepEqual(recovered.value.claimIds, [
  "claim-initial",
  "claim-retained-a",
  "claim-retained-b",
]);
assert.equal(recovered.value.claimIds.includes("claim-discarded"), false);
assert.deepEqual(
  validateCreatorScriptBuildGeneratedSectionLength({
    value: recovered.value,
    budget,
  }),
  {
    accepted: true,
    wordCount: 338,
    minimumWords: 285,
    targetWords: 317,
    maximumWords: 349,
    reason: "accepted",
  },
);

const repeated = selectCreatorScriptBuildSectionContinuationPrefix({
  previous: {
    ...initial,
    text: `${sentence(272, "base")} This tension shows why status can migrate outside paid work.`,
  },
  continuation: {
    segments: [{
      text: "This tension shows why status can migrate into new scoreboards.",
      claimIds: [],
    }],
  },
  budget,
});
assert.equal(repeated.accepted, false);
assert.equal(repeated.reason, "local_repetition");

const incomplete = selectCreatorScriptBuildSectionContinuationPrefix({
  previous: initial,
  continuation: {
    segments: [{ text: words(20, "unfinished"), claimIds: [] }],
  },
  budget,
});
assert.equal(incomplete.accepted, false);
assert.equal(incomplete.reason, "sentence_incomplete");

const noValidPrefix = selectCreatorScriptBuildSectionContinuationPrefix({
  previous: initial,
  continuation: {
    segments: [
      { text: sentence(5, "short"), claimIds: [] },
      { text: sentence(80, "overshoot"), claimIds: [] },
    ],
  },
  budget,
});
assert.equal(noValidPrefix.accepted, false);
assert.equal(noValidPrefix.reason, "above_maximum");

const overMaximumFullSection = validateCreatorScriptBuildGeneratedSectionLength({
  value: { text: sentence(378, "replacement") },
  budget,
});
assert.equal(overMaximumFullSection.reason, "above_maximum");
assert.equal(
  createCreatorScriptBuildSectionContinuationBand(overMaximumFullSection),
  null,
  "an over-maximum full section must not enter additive continuation recovery",
);
assert.deepEqual(
  createCreatorScriptBuildSectionLengthRecoveryBand(overMaximumFullSection),
  { minimumWords: 285, maximumWords: 317 },
  "an over-maximum full section must retain the existing replacement band",
);

const provider = fs.readFileSync(
  new URL("../lib/creator/creatorScriptBuildProviders.server.ts", import.meta.url),
  "utf8",
);
assert.match(provider, /maxItems: 12/u);
assert.match(provider, /Every segment MUST be exactly one complete sentence/u);
assert.match(provider, /sentence-local permitted claim IDs/u);
assert.match(provider, /selectCreatorScriptBuildSectionContinuationPrefix/u);
assert.match(provider, /length-retry:2/u);
assert.match(
  provider,
  /CREATOR_SCRIPT_BUILD_GENERATED_SECTION_CONTINUATION_PREFIX_INVALID/u,
);

// Above-maximum initial sections still take the existing full replacement path.
assert.match(
  provider,
  /const continuationBand = previousValidation[\s\S]*createCreatorScriptBuildSectionContinuationBand/u,
);
assert.match(
  provider,
  /if \(ordinal === 2 && continuationBand && initialCandidate\)/u,
);

console.log("stage-0-19f-f20-bounded-continuation-prefix-test: PASS");
