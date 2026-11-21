import assert from "node:assert/strict";

import {
  assertCreatorScriptHasSafeSectionStructure,
  createCreatorScript,
  createCreatorScriptSectionBudgetPlan,
  getCreatorScriptDurationContract,
  getCreatorScriptDurationContractForScript,
  getCreatorScriptRepairReplacementDiagnostics,
  mergeCreatorScriptReplacementSections,
} from "../lib/creator/creatorScript.ts";

const words = (count, prefix = "word") => Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(" ");

function assertPlanInvariants(targetDurationSec, language) {
  const duration = getCreatorScriptDurationContract({ targetDurationSec, language, actualWordCount: 0 });
  const plan = createCreatorScriptSectionBudgetPlan({ targetDurationSec, language });
  assert.equal(plan.reduce((sum, section) => sum + section.targetWords, 0), duration.targetWordCount);
  assert.ok(plan.every((section) => section.targetWords > 0));
  assert.ok(plan.every((section) => section.minimumWords <= section.targetWords));
  assert.ok(plan.every((section) => section.targetWords <= section.maximumWords));
  assert.ok(plan.filter((section) => section.kind === "body")
    .reduce((sum, section) => sum + section.targetWords, 0) > duration.targetWordCount / 2);
  return { duration, plan };
}

const en30 = assertPlanInvariants(30, "en");
assert.deepEqual(
  [en30.duration.targetWordCount, en30.duration.minimumAcceptableWordCount, en30.duration.maximumAcceptableWordCount],
  [71, 64, 78],
);
assert.deepEqual(
  en30.plan.map(({ id, minimumWords, targetWords, maximumWords }) => [id, minimumWords, targetWords, maximumWords]),
  [["opening", 4, 5, 6], ["section-1", 46, 52, 58], ["conclusion", 12, 14, 16]],
);

const tr30 = assertPlanInvariants(30, "tr");
assert.deepEqual(
  [tr30.duration.targetWordCount, tr30.duration.minimumAcceptableWordCount, tr30.duration.maximumAcceptableWordCount],
  [65, 59, 71],
);
assert.deepEqual(
  tr30.plan.map(({ id, minimumWords, targetWords, maximumWords }) => [id, minimumWords, targetWords, maximumWords]),
  [["opening", 4, 5, 6], ["section-1", 42, 47, 52], ["conclusion", 11, 13, 15]],
);

assertPlanInvariants(5, "en");
assertPlanInvariants(5, "tr");

for (const [targetDurationSec, language, expectedTargets] of [
  [60, "en", [11, 115, 15]],
  [90, "en", [16, 173, 23]],
  [960, "en", [180, 308, 308, 308, 308, 308, 308, 228]],
]) {
  const { plan } = assertPlanInvariants(targetDurationSec, language);
  assert.deepEqual(plan.map((section) => section.targetWords), expectedTargets);
}

const grounding = {
  context: {
    version: "0.10H-2H",
    sourceVersion: "0.10H-2E",
    editorialConstitution: "Preserve evidence and uncertainty.",
    readiness: { status: "ready", editorialReadinessScore: 90, reviewReasons: [] },
    claims: [],
    evidence: [],
    sources: [],
  },
};
const initial = createCreatorScript({
  title: "Short-form budget fixture",
  sections: [
    { id: "opening", kind: "opening", heading: "Opening", text: words(5, "opening"), claimIds: [], evidenceReviewRequired: false },
    { id: "section-1", kind: "body", heading: "Grounded Argument", text: words(54, "body"), claimIds: [], evidenceReviewRequired: false },
    { id: "conclusion", kind: "conclusion", heading: "Conclusion", text: words(18, "initialConclusion"), claimIds: [], evidenceReviewRequired: false },
  ],
  targetDurationSec: 30,
  strategyFingerprint: "short-form-budget-fixture",
  grounding,
  generatedAt: "2026-09-28T00:00:00.000Z",
  updatedAt: "2026-09-28T00:00:00.000Z",
});
assert.equal(getCreatorScriptDurationContractForScript(initial, "en").actualWordCount, 77);
assert.equal(getCreatorScriptDurationContractForScript(initial, "en").status, "compliant");
assert.throws(() => assertCreatorScriptHasSafeSectionStructure(initial, en30.plan), /SECTION_BUDGET_UNSATISFIED/);

const validConclusion = { ...initial.sections.at(-1), text: words(14, "repairedConclusion") };
const validReplacement = getCreatorScriptRepairReplacementDiagnostics({
  script: initial,
  plan: en30.plan,
  replacements: [validConclusion],
});
assert.equal(validReplacement[0].accepted, true);
assert.equal(validReplacement[0].reason, "accepted_within_section_envelope");
const repaired = mergeCreatorScriptReplacementSections({ script: initial, plan: en30.plan, replacements: [validConclusion] });
assert.doesNotThrow(() => assertCreatorScriptHasSafeSectionStructure(repaired, en30.plan));
assert.equal(getCreatorScriptDurationContractForScript(repaired, "en").status, "compliant");

const excessiveConclusion = { ...initial.sections.at(-1), text: words(17, "excessiveConclusion") };
const excessiveReplacement = getCreatorScriptRepairReplacementDiagnostics({
  script: initial,
  plan: en30.plan,
  replacements: [excessiveConclusion],
});
assert.equal(excessiveReplacement[0].accepted, false);
assert.equal(excessiveReplacement[0].reason, "above_maximum");

console.log("Stage 0.18A6D short-form script budget reliability: PASS");
