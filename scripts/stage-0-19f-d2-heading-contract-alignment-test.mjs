import assert from "node:assert/strict";
import fs from "node:fs";

import {
  getCreatorScriptEditorialDistinctivenessDiagnostics,
} from "../lib/creator/creatorScript.ts";

const textById = Object.freeze({
  opening: "Opening narration remains unchanged.",
  "section-1": "First body narration remains unchanged.",
  "section-2": "Second body narration remains unchanged.",
  conclusion: "Conclusion narration remains unchanged.",
});

const plan = [
  { id: "opening", kind: "opening", role: "Open", centralQuestion: "Why?", progression: "Open.", ownershipBoundary: { usage: "control_only_never_narrate", owns: [], excludes: [] }, minimumWords: 1, targetWords: 2, maximumWords: 20 },
  { id: "section-1", kind: "body", role: "Define", centralQuestion: "What?", progression: "Define.", ownershipBoundary: { usage: "control_only_never_narrate", owns: [], excludes: [] }, minimumWords: 1, targetWords: 2, maximumWords: 20 },
  { id: "section-2", kind: "body", role: "Explain", centralQuestion: "How?", progression: "Explain.", ownershipBoundary: { usage: "control_only_never_narrate", owns: [], excludes: [] }, minimumWords: 1, targetWords: 2, maximumWords: 20 },
  { id: "conclusion", kind: "conclusion", role: "Conclude", centralQuestion: "Then?", progression: "Conclude.", ownershipBoundary: { usage: "control_only_never_narrate", owns: [], excludes: [] }, minimumWords: 1, targetWords: 2, maximumWords: 20 },
];

function script(headings) {
  return {
    sections: plan.map((section) => ({
      id: section.id,
      kind: section.kind,
      ...(Object.hasOwn(headings, section.id) ? { heading: headings[section.id] } : {}),
      text: textById[section.id],
      claimIds: [],
      evidenceReviewRequired: false,
    })),
  };
}

function diagnostics(headings) {
  const candidate = script(headings);
  const narrationBefore = candidate.sections.map(({ id, text }) => ({ id, text }));
  const result = getCreatorScriptEditorialDistinctivenessDiagnostics(candidate, plan);
  assert.deepEqual(candidate.sections.map(({ id, text }) => ({ id, text })), narrationBefore);
  return result;
}

assert.deepEqual(diagnostics({ "section-1": null, "section-2": "Distinct Social Structure" }), []);
assert.deepEqual(diagnostics({ "section-1": "", "section-2": "   \n\t " }), []);
assert.deepEqual(diagnostics({ "section-2": "Distinct Social Structure" }), []);

const lowInformation = diagnostics({
  "section-1": "Meaning",
  "section-2": "Distinct Social Structure",
});
assert.equal(lowInformation.length, 1);
assert.equal(lowInformation[0].sectionId, "section-1");
assert.equal(lowInformation[0].failureType, "heading_insufficient_distinct_tokens");
assert.equal(lowInformation[0].meaningfulHeadingTokenCount, 1);

assert.deepEqual(diagnostics({
  "section-1": "Identity Beyond Employment",
  "section-2": "Purpose Through Community",
}), []);

const overlapping = diagnostics({
  "section-1": "Identity Beyond Employment",
  "section-2": "Employment Beyond Identity",
});
assert.equal(overlapping.length, 1);
assert.equal(overlapping[0].failureType, "heading_token_overlap");
assert.equal(overlapping[0].sectionId, "section-2");
assert.equal(overlapping[0].comparedSectionId, "section-1");
assert.equal(overlapping[0].overlapRatio, 1);

const providers = fs.readFileSync(new URL("../lib/creator/creatorScriptBuildProviders.server.ts", import.meta.url), "utf8");
const repair = fs.readFileSync(new URL("../lib/creator/creatorScriptBuildScriptRepairCoordinator.ts", import.meta.url), "utf8");
const authority = fs.readFileSync(new URL("../lib/creator/creatorScriptBuildAuthorityCoordinator.ts", import.meta.url), "utf8");

assert.match(providers, /heading: \{ type: \["string", "null"\] \}/u);
assert.match(providers, /optional headings/u);
assert.match(providers, /CREATOR_SCRIPT_DOCUMENTARY_WRITING_CONTRACT/u);
assert.match(repair, /CREATOR_SCRIPT_BUILD_MAX_REPAIR_ATTEMPTS = 2 as const/u);
assert.match(repair, /CREATOR_SCRIPT_BUILD_MAX_CANDIDATES_PER_TARGET = 2 as const/u);
assert.match(authority, /DUPLICATE_CLAIM_ID/u);
assert.match(authority, /normalizationReason/u);
assert.match(authority, /providerRequestId/u);
assert.match(authority, /providerResponseId/u);

console.log("stage-0-19f-d2-heading-contract-alignment-test: ok");
