import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  acceptCreatorScriptWithAcceptanceRepair,
  createCreatorScript,
  createCreatorScriptSectionBudgetPlan,
  CreatorScriptPolicyUnsatisfiedError,
  getCreatorScriptDurationContract,
  mergeCreatorScriptSectionUnits,
} from "../lib/creator/creatorScript.ts";
import {
  CREATOR_SCRIPT_ACCEPTANCE_VERSION,
  creatorScriptAcceptanceMateriallyImproved,
  evaluateCreatorScriptAcceptance,
  getCreatorScriptAcceptanceFailure,
} from "../lib/creator/creatorScriptAcceptance.ts";

const context = {
  version: "0.10H-2H",
  sourceVersion: "0.10H-2E",
  editorialConstitution: "Preserve evidence and uncertainty.",
  readiness: {
    status: "ready",
    editorialReadinessScore: 100,
    reviewReasons: [],
    primarySourceRequiredClaimIds: [],
    primarySourceCoveredClaimIds: [],
  },
  claims: [],
  evidence: [],
  sources: [],
};
const words = (count) => Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
const headings = [
  "Opening Human Tension",
  "Definition Boundaries",
  "Mechanism Reconstruction",
  "Evidence Demonstration",
  "Limits Counterview",
  "Social Formation",
  "Material Consequences",
  "Identity Unresolved",
];
const plan = createCreatorScriptSectionBudgetPlan({ targetDurationSec: 300, language: "en" });
const duration = getCreatorScriptDurationContract({ targetDurationSec: 300, language: "en", actualWordCount: 0 });

const allocate = (total, sourcePlan = plan) => {
  const planTotal = sourcePlan.reduce((sum, section) => sum + section.targetWords, 0);
  const counts = sourcePlan.map((section) => Math.max(1, Math.floor(section.targetWords * total / planTotal)));
  let remaining = total - counts.reduce((sum, count) => sum + count, 0);
  for (let index = 0; remaining > 0; index = (index + 1) % counts.length) {
    counts[index] += 1;
    remaining -= 1;
  }
  return counts;
};

const makeScript = (counts = plan.map((section) => section.targetWords), input = {}) => createCreatorScript({
  title: "Canonical acceptance fixture",
  sections: plan.map((budget, index) => ({
    id: budget.id,
    kind: budget.kind,
    heading: input.headings?.[index] ?? headings[index],
    text: input.texts?.[index] ?? words(counts[index]),
    claimIds: [],
    evidenceReviewRequired: input.evidenceReviewSectionId === budget.id,
  })),
  targetDurationSec: 300,
  strategyFingerprint: "stage-0-19d",
  grounding: { context: input.context ?? context },
  generatedAt: "2026-10-02T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
});

const evaluate = (script) => evaluateCreatorScriptAcceptance({
  script,
  sectionPlan: plan,
  language: "en",
  narrationAuthority: "memory identity evidence",
});
const codes = (report) => report.violations.map((violation) => violation.code);

// 1. A fully compliant script is accepted by the one canonical report.
const acceptedScript = makeScript();
const accepted = evaluate(acceptedScript);
assert.equal(accepted.version, CREATOR_SCRIPT_ACCEPTANCE_VERSION);
assert.equal(accepted.accepted, true);
assert.equal(accepted.repairRequired, false);
assert.deepEqual(accepted.blockingViolations, []);

// 2, 19. Any local maximum overflow, including three words, is hard and targeted.
const overIndex = 1;
const overCounts = plan.map((section) => section.targetWords);
const overGain = plan[overIndex].maximumWords + 3 - overCounts[overIndex];
overCounts[overIndex] += overGain;
overCounts[2] -= overGain;
const threeOver = evaluate(makeScript(overCounts));
assert.equal(threeOver.duration.status, "compliant");
assert.equal(threeOver.accepted, false);
assert.equal(threeOver.repairRequired, true);
assert.equal(
  threeOver.violations.find((violation) => violation.code === "SECTION_OVER_MAX")?.diagnostics.excessWords,
  3,
);
assert.deepEqual(threeOver.repairSectionIds, [plan[overIndex].id]);

// 3, 18. A local minimum deficit is explicitly soft under a compliant global envelope.
const underCounts = plan.map((section) => section.targetWords);
const underLoss = underCounts[1] - (plan[1].minimumWords - 1);
underCounts[1] -= underLoss;
let underRedistribution = underLoss;
for (const index of [0, 2, 3]) {
  const gain = Math.min(underRedistribution, plan[index].maximumWords - underCounts[index]);
  underCounts[index] += gain;
  underRedistribution -= gain;
}
assert.equal(underRedistribution, 0);
const softUnder = evaluate(makeScript(underCounts));
assert.equal(softUnder.duration.status, "compliant");
assert.ok(codes(softUnder).includes("SECTION_SOFT_UNDER_MIN"));
assert.equal(softUnder.violations.find((violation) => violation.code === "SECTION_SOFT_UNDER_MIN")?.severity, "soft");
assert.equal(softUnder.accepted, true);
assert.equal(softUnder.repairRequired, false);
assert.deepEqual(softUnder.repairSectionIds, []);

// 4-5. Global envelope failures are hard and repairable within the bounded residual path.
const tooShort = evaluate(makeScript(allocate(duration.minimumAcceptableWordCount - 1)));
assert.equal(tooShort.accepted, false);
assert.equal(tooShort.repairRequired, true);
assert.ok(codes(tooShort).includes("GLOBAL_DURATION_TOO_SHORT"));
assert.ok(tooShort.repairSectionIds.length > 0);
const tooLong = evaluate(makeScript(allocate(duration.maximumAcceptableWordCount + 1)));
assert.equal(tooLong.accepted, false);
assert.equal(tooLong.repairRequired, true);
assert.ok(codes(tooLong).includes("GLOBAL_DURATION_TOO_LONG"));

// 6. A missing required section blocks repair rather than inventing structure.
const missingScript = { ...acceptedScript, sections: acceptedScript.sections.filter((section) => section.id !== plan[1].id) };
const missing = evaluate(missingScript);
assert.equal(missing.accepted, false);
assert.equal(missing.repairRequired, false);
assert.ok(missing.blockingViolations.some((violation) => violation.code === "SECTION_MISSING" && violation.sectionId === plan[1].id));
const reorderedScript = { ...acceptedScript, sections: [acceptedScript.sections[0], acceptedScript.sections[2], acceptedScript.sections[1], acceptedScript.sections[3]] };
assert.ok(evaluate(reorderedScript).blockingViolations.some((violation) =>
  violation.code === "SECTION_MISSING"
  && violation.diagnostics.reason === "section_order_or_kind_mismatch"
));

// 7. A zero-word required section is a hard structural policy violation.
const emptyScript = { ...acceptedScript, sections: acceptedScript.sections.map((section) => section.id === plan[1].id ? { ...section, text: "" } : section) };
const empty = evaluate(emptyScript);
assert.equal(empty.accepted, false);
assert.ok(empty.blockingViolations.some((violation) => violation.code === "SECTION_EMPTY"));

// 8. Distinctiveness comes from the report and targets the affected later section.
const duplicateHeadings = headings.slice();
duplicateHeadings[2] = duplicateHeadings[1];
const duplicateHeadingScript = makeScript(undefined, { headings: duplicateHeadings });
const distinctiveness = evaluate(duplicateHeadingScript);
assert.equal(distinctiveness.repairRequired, true);
assert.ok(distinctiveness.repairableViolations.some((violation) => violation.code === "EDITORIAL_DISTINCTIVENESS"));
assert.ok(distinctiveness.repairSectionIds.includes(plan[2].id));

// 9. Narration safety is a structured hard blocker without weakening detection.
const unsafeTexts = plan.map((section) => words(section.targetWords));
unsafeTexts[0] = `This inquiry does not seek easy answers. ${words(plan[0].targetWords - 7)}`;
const unsafe = evaluate(makeScript(undefined, { texts: unsafeTexts }));
assert.equal(unsafe.accepted, false);
assert.equal(unsafe.repairRequired, false);
assert.ok(unsafe.blockingViolations.some((violation) => violation.code === "NARRATION_SAFETY" && violation.diagnostics.category === "internal_editorial_leakage"));
assert.equal(getCreatorScriptAcceptanceFailure(unsafe).code, "CREATOR_SCRIPT_NARRATION_EDITORIAL_LEAKAGE");

// 10. Grounding remains an authoritative input and is represented distinctly.
const grounding = evaluate(makeScript(undefined, { evidenceReviewSectionId: plan[1].id }));
assert.equal(grounding.accepted, false);
assert.equal(grounding.repairRequired, false);
assert.ok(grounding.blockingViolations.some((violation) => violation.code === "GROUNDING_BLOCKED"));
assert.equal(getCreatorScriptAcceptanceFailure(grounding).category, "GROUNDING");

// 11-12. Simultaneous repairable failures remain visible and solely determine targets.
const multiple = evaluate(makeScript(overCounts, { headings: duplicateHeadings }));
assert.ok(codes(multiple).includes("SECTION_OVER_MAX"));
assert.ok(codes(multiple).includes("EDITORIAL_DISTINCTIVENESS"));
assert.deepEqual(multiple.repairSectionIds, [plan[1].id, plan[2].id]);
const violationTargetIds = new Set(multiple.repairableViolations.map((violation) => violation.sectionId).filter(Boolean));
assert.ok(multiple.repairSectionIds.every((sectionId) => violationTargetIds.has(sectionId)));

// 13. Repair dispatch and final acceptance both consume the same report.
let repairCalls = 0;
const repaired = await acceptCreatorScriptWithAcceptanceRepair({
  firstScript: makeScript(overCounts),
  evaluate,
  repair: async (report) => {
    repairCalls += 1;
    assert.equal(report.repairRequired, true);
    assert.deepEqual(report.repairSectionIds, [plan[overIndex].id]);
    return acceptedScript;
  },
  maxRepairAttempts: 2,
  shouldRetryRepair: creatorScriptAcceptanceMateriallyImproved,
});
assert.equal(repairCalls, 1);
assert.equal(repaired.report.accepted, true);
assert.equal(repaired.repaired, true);

// 14. Repairing one issue cannot conceal another remaining hard violation.
await assert.rejects(
  acceptCreatorScriptWithAcceptanceRepair({
    firstScript: makeScript(overCounts, { headings: duplicateHeadings }),
    evaluate,
    repair: async () => duplicateHeadingScript,
    maxRepairAttempts: 1,
  }),
  (error) => error instanceof CreatorScriptPolicyUnsatisfiedError
    && error.report.accepted === false
    && codes(error.report).includes("EDITORIAL_DISTINCTIVENESS"),
);

// 15. A repair introducing a new hard narration violation is never accepted.
await assert.rejects(
  acceptCreatorScriptWithAcceptanceRepair({
    firstScript: makeScript(overCounts),
    evaluate,
    repair: async () => makeScript(undefined, { texts: unsafeTexts }),
    maxRepairAttempts: 2,
    shouldRetryRepair: creatorScriptAcceptanceMateriallyImproved,
  }),
  (error) => error instanceof CreatorScriptPolicyUnsatisfiedError
    && error.report.blockingViolations.some((violation) => violation.code === "NARRATION_SAFETY"),
);

// Retry is measurable report improvement, never mere prose change.
assert.equal(creatorScriptAcceptanceMateriallyImproved({ previous: tooShort, current: tooShort }), false);
const lessShort = evaluate(makeScript(allocate(duration.minimumAcceptableWordCount - 2)));
assert.equal(creatorScriptAcceptanceMateriallyImproved({ previous: tooShort, current: lessShort }), false);
assert.equal(creatorScriptAcceptanceMateriallyImproved({ previous: lessShort, current: tooShort }), true);

// 20. Exact historical 1451 / 1396 / 1706 shape cannot bypass a +3 local max repair.
const historicalPlan = createCreatorScriptSectionBudgetPlan({ targetDurationSec: 660, language: "en" });
const historicalDuration = getCreatorScriptDurationContract({ targetDurationSec: 660, language: "en", actualWordCount: 1451 });
assert.deepEqual(
  [historicalDuration.actualWordCount, historicalDuration.minimumAcceptableWordCount, historicalDuration.maximumAcceptableWordCount],
  [1451, 1396, 1706],
);
const historicalCounts = historicalPlan.map((section) => section.targetWords);
const historicalOverIndex = 1;
const historicalGain = historicalPlan[historicalOverIndex].maximumWords + 3 - historicalCounts[historicalOverIndex];
historicalCounts[historicalOverIndex] += historicalGain;
let historicalReduction = historicalCounts.reduce((sum, count) => sum + count, 0) - 1451;
for (let index = historicalCounts.length - 1; index >= 0 && historicalReduction > 0; index -= 1) {
  if (index === historicalOverIndex) continue;
  const reduction = Math.min(historicalReduction, historicalCounts[index] - 1);
  historicalCounts[index] -= reduction;
  historicalReduction -= reduction;
}
const historicalScript = createCreatorScript({
  ...acceptedScript,
  sections: historicalPlan.map((budget, index) => ({
    id: budget.id,
    kind: budget.kind,
    heading: headings[index],
    text: words(historicalCounts[index]),
    claimIds: [],
    evidenceReviewRequired: false,
  })),
  targetDurationSec: 660,
});
const historicalReport = evaluateCreatorScriptAcceptance({
  script: historicalScript,
  sectionPlan: historicalPlan,
  language: "en",
  narrationAuthority: "",
});
assert.equal(historicalReport.duration.status, "compliant");
assert.equal(historicalReport.repairRequired, true);
assert.equal(historicalReport.violations.find((violation) => violation.code === "SECTION_OVER_MAX")?.diagnostics.excessWords, 3);
assert.ok(historicalReport.repairSectionIds.includes(historicalPlan[historicalOverIndex].id));

// 25. Raw malformed output remains a model/normalization contract failure.
assert.throws(
  () => mergeCreatorScriptSectionUnits({ sections: [], plan }),
  /CREATOR_SCRIPT_SECTION_UNITS_INCOMPLETE/,
);
assert.throws(
  () => mergeCreatorScriptSectionUnits({ sections: plan.map(() => ({})), plan }),
  /CREATOR_SCRIPT_SECTION_UNIT_INVALID/,
);

// 16-17. Route dispatch and success are report-owned; no parallel final predicate remains.
const route = await readFile(new URL("../app/api/creator-script-plan/route.ts", import.meta.url), "utf8");
assert.match(route, /acceptCreatorScriptWithAcceptanceRepair/);
assert.match(route, /evaluateCreatorScriptAcceptance/);
assert.match(route, /repairIds = new Set\(currentReport\.repairSectionIds\)/);
assert.match(route, /const finalDuration = accepted\.report\.duration/);
assert.match(route, /const orderedUnit = mergeCreatorScriptSectionUnits[\s\S]*assertCreatorScriptNarrationIsProductionSafe[\s\S]*return orderedUnit/, "section-native safety remains fail-fast and does not broaden provider calls");
assert.doesNotMatch(route, /requiresRepair:\s*\(script\)/);
assert.doesNotMatch(route, /validateFinal:\s*\(script\)/);
assert.match(route, /category:\s*failure\.category/);
assert.match(route, /narrationSafetyFailure/);
assert.match(route, /\? "INTERNAL"[\s\S]*\? "SCRIPT_POLICY"[\s\S]*: "MODEL_CONTRACT"/);

console.log("Stage 0.19D Creator Script Acceptance regression passed.");
