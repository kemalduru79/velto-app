import assert from "node:assert/strict";
import fs from "node:fs";

import {
  assertCreatorScriptSatisfiesSectionBudgets,
  createCreatorScript,
  createCreatorScriptSectionBudgetPlan,
  generateCreatorScriptWithDurationContract,
  getCreatorScriptDurationRepairSections,
  getCreatorScriptMaterialSectionFailures,
  getCreatorScriptRepairReplacementDiagnostics,
  mergeCreatorScriptReplacementSections,
} from "../lib/creator/creatorScript.ts";

const words = (count, prefix) => Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(" ");
const plan = createCreatorScriptSectionBudgetPlan({ targetDurationSec: 30, language: "en" });
assert.deepEqual(
  plan.map(({ id, minimumWords, targetWords, maximumWords }) => [id, minimumWords, targetWords, maximumWords]),
  [["opening", 4, 5, 6], ["section-1", 46, 52, 58], ["conclusion", 12, 14, 16]],
);

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
const makeScript = (openingWords, bodyWords, conclusionWords) => createCreatorScript({
  title: "Bounded residual repair fixture",
  sections: [
    { id: "opening", kind: "opening", heading: "Opening Question", text: words(openingWords, "opening"), claimIds: [], evidenceReviewRequired: false },
    { id: "section-1", kind: "body", heading: "Grounded Mechanism", text: words(bodyWords, "body"), claimIds: [], evidenceReviewRequired: false },
    { id: "conclusion", kind: "conclusion", heading: "Unresolved Implication", text: words(conclusionWords, "conclusion"), claimIds: [], evidenceReviewRequired: false },
  ],
  targetDurationSec: 30,
  strategyFingerprint: "bounded-residual-repair",
  grounding,
  generatedAt: "2026-09-28T00:00:00.000Z",
  updatedAt: "2026-09-28T00:00:00.000Z",
});
const requiresRepair = (script) => getCreatorScriptMaterialSectionFailures(script, plan).length > 0;
const validateFinal = (script) => assertCreatorScriptSatisfiesSectionBudgets(script, plan);

let runtimeRepairCalls = 0;
const runtimeResult = await generateCreatorScriptWithDurationContract({
  durationSec: 30,
  language: "en",
  maxRepairAttempts: 2,
  generateInitial: async () => makeScript(6, 38, 23),
  requiresRepair,
  validateFinal,
  repair: async (currentScript, duration, attempt) => {
    runtimeRepairCalls += 1;
    assert.equal(duration.status, "compliant");
    const targets = getCreatorScriptDurationRepairSections({ script: currentScript, plan, duration });
    if (attempt === 1) {
      assert.deepEqual(targets.map((target) => target.id), ["section-1", "conclusion"]);
      const replacements = [
        { ...currentScript.sections[1], text: words(49, "bodyRepair") },
        { ...currentScript.sections[2], text: words(32, "badConclusionRepair") },
      ];
      const diagnostics = getCreatorScriptRepairReplacementDiagnostics({ script: currentScript, plan, replacements });
      assert.deepEqual(diagnostics.map(({ sectionId, accepted, reason }) => [sectionId, accepted, reason]), [
        ["section-1", true, "accepted_within_section_envelope"],
        ["conclusion", false, "above_maximum"],
      ]);
      const accepted = diagnostics.filter((candidate) => candidate.accepted).map((candidate) => candidate.replacement);
      return mergeCreatorScriptReplacementSections({ script: currentScript, plan, replacements: accepted });
    }
    assert.deepEqual(targets.map((target) => target.id), ["conclusion"]);
    assert.deepEqual(currentScript.sections.map((section) => section.text.split(/\s+/u).length), [6, 49, 23]);
    return mergeCreatorScriptReplacementSections({
      script: currentScript,
      plan,
      replacements: [{ ...currentScript.sections[2], text: words(14, "conclusionRepair") }],
    });
  },
});
assert.equal(runtimeRepairCalls, 2);
assert.equal(runtimeResult.repairAttempts, 2);
assert.equal(runtimeResult.diagnostics.actualWordCount, 69);
assert.equal(runtimeResult.diagnostics.status, "compliant");
assert.deepEqual(runtimeResult.creatorScript.sections.map((section) => section.text.split(/\s+/u).length), [6, 49, 14]);

let failedResidualCalls = 0;
await assert.rejects(generateCreatorScriptWithDurationContract({
  durationSec: 30,
  language: "en",
  maxRepairAttempts: 2,
  generateInitial: async () => makeScript(6, 38, 23),
  requiresRepair,
  validateFinal,
  repair: async (currentScript, _duration, attempt) => {
    failedResidualCalls += 1;
    return attempt === 1
      ? mergeCreatorScriptReplacementSections({ script: currentScript, plan, replacements: [{ ...currentScript.sections[1], text: words(49, "bodyRepair") }] })
      : currentScript;
  },
}), /CREATOR_SCRIPT_SECTION_BUDGET_UNSATISFIED/);
assert.equal(failedResidualCalls, 2);

let fullRepairCalls = 0;
const fullyRepaired = await generateCreatorScriptWithDurationContract({
  durationSec: 30,
  language: "en",
  maxRepairAttempts: 2,
  generateInitial: async () => makeScript(6, 38, 23),
  requiresRepair,
  validateFinal,
  repair: async () => {
    fullRepairCalls += 1;
    return makeScript(6, 49, 14);
  },
});
assert.equal(fullRepairCalls, 1);
assert.equal(fullyRepaired.repairAttempts, 1);

let compliantRepairCalls = 0;
const compliant = await generateCreatorScriptWithDurationContract({
  durationSec: 30,
  language: "en",
  maxRepairAttempts: 2,
  generateInitial: async () => makeScript(5, 52, 14),
  requiresRepair,
  validateFinal,
  repair: async (script) => {
    compliantRepairCalls += 1;
    return script;
  },
});
assert.equal(compliantRepairCalls, 0);
assert.equal(compliant.repaired, false);

let unrelatedFailureCalls = 0;
await assert.rejects(generateCreatorScriptWithDurationContract({
  durationSec: 30,
  language: "en",
  maxRepairAttempts: 2,
  generateInitial: async () => makeScript(6, 38, 23),
  requiresRepair,
  validateFinal: () => { throw new Error("UNRELATED_FINAL_VALIDATION_FAILURE"); },
  repair: async () => {
    unrelatedFailureCalls += 1;
    return makeScript(6, 49, 14);
  },
}), /UNRELATED_FINAL_VALIDATION_FAILURE/);
assert.equal(unrelatedFailureCalls, 1);

let groundingFailureCalls = 0;
await assert.rejects(generateCreatorScriptWithDurationContract({
  durationSec: 30,
  language: "en",
  maxRepairAttempts: 2,
  generateInitial: async () => makeScript(6, 38, 23),
  requiresRepair,
  validateFinal: () => { throw new Error("CREATOR_SCRIPT_GROUNDING_BLOCKED"); },
  repair: async () => {
    groundingFailureCalls += 1;
    return makeScript(6, 49, 14);
  },
}), /CREATOR_SCRIPT_GROUNDING_BLOCKED/);
assert.equal(groundingFailureCalls, 1);

const route = fs.readFileSync(new URL("../app/api/creator-script-plan/route.ts", import.meta.url), "utf8");
assert.match(route, /maxRepairAttempts: 2/);
assert.doesNotMatch(route, /maxRepairAttempts: sectionNative \? 2 : 1/);

console.log("Stage 0.18A6D.1 bounded residual section repair: PASS");
