import assert from "node:assert/strict";
import {
  CREATOR_SCRIPT_MIN_ATOMIC_ADDITIVE_GAIN_WORDS,
  createCreatorScriptAdditiveExpansionPlan,
  createCreatorScriptSectionBudgetPlan,
  getCreatorScriptDurationContract,
  selectCreatorScriptExpansionCandidates,
} from "../lib/creator/creatorScript.ts";

const plan = createCreatorScriptSectionBudgetPlan({
  targetDurationSec: 960,
  language: "en",
  hasMaterialCounterview: true,
});

function words(count) {
  return `${Array(Math.max(1, count - 3)).fill("word").join(" ")}. Final question remains?`;
}

function scriptWithCounts(counts) {
  return {
    version: "0.13D",
    revision: 1,
    title: "Fixture",
    targetDurationSec: 960,
    strategyFingerprint: "fixture",
    generatedAt: "2026-09-24T00:00:00.000Z",
    updatedAt: "2026-09-24T00:00:00.000Z",
    approval: null,
    grounding: { context: null },
    sections: plan.map((budget, index) => ({
      id: budget.id,
      kind: budget.kind,
      heading: budget.role,
      text: words(counts[index]),
      claimIds: [],
      evidenceReviewRequired: false,
    })),
  };
}

function countsAtTotal(total) {
  const counts = plan.map((budget) => budget.targetWords);
  let reduction = counts.reduce((sum, value) => sum + value, 0) - total;
  for (let index = 0; reduction > 0; index = (index + 1) % counts.length) {
    if (counts[index] <= 30) continue;
    counts[index] -= 1;
    reduction -= 1;
  }
  return counts;
}

const liveCounts = countsAtTotal(2021);
assert.equal(liveCounts.reduce((sum, count) => sum + count, 0), 2021);
const livePlan = createCreatorScriptAdditiveExpansionPlan({
  script: scriptWithCounts(liveCounts),
  plan,
  globalDeficitWords: 10,
});
assert.deepEqual(livePlan.map(({ sectionId, requestedGainWords }) => ({
  sectionId,
  requestedGainWords,
})), [{
  sectionId: "section-1",
  requestedGainWords: CREATOR_SCRIPT_MIN_ATOMIC_ADDITIVE_GAIN_WORDS,
}]);
assert.ok(livePlan.every((target) => target.requestedGainWords > 2));
assert.deepEqual(createCreatorScriptAdditiveExpansionPlan({
  script: scriptWithCounts(liveCounts),
  plan,
  globalDeficitWords: CREATOR_SCRIPT_MIN_ATOMIC_ADDITIVE_GAIN_WORDS,
}).map(({ sectionId, requestedGainWords }) => ({ sectionId, requestedGainWords })), [{
  sectionId: "section-1",
  requestedGainWords: CREATOR_SCRIPT_MIN_ATOMIC_ADDITIVE_GAIN_WORDS,
}]);

const firstRepairPlan = createCreatorScriptAdditiveExpansionPlan({
  script: scriptWithCounts(countsAtTotal(1865)),
  plan,
  globalDeficitWords: 166,
});
assert.equal(firstRepairPlan.length, 6);
assert.equal(firstRepairPlan.reduce((sum, target) => sum + target.requestedGainWords, 0), 166);
assert.deepEqual(firstRepairPlan.map((target) => target.requestedGainWords), [28, 28, 28, 28, 27, 27]);

const selectedAtomic = selectCreatorScriptExpansionCandidates({
  deficitWords: 10,
  candidates: [{ sectionId: "section-1", gainWords: 20, value: "complete sentence" }],
  canonicalSectionOrder: plan.map((section) => section.id),
});
assert.equal(selectedAtomic.length, 1);
assert.equal(2021 + selectedAtomic[0].gainWords, 2041);
assert.equal(getCreatorScriptDurationContract({ targetDurationSec: 960, language: "en", actualWordCount: 2041 }).status, "compliant");

const insufficient = selectCreatorScriptExpansionCandidates({
  deficitWords: 10,
  candidates: [{ sectionId: "section-1", gainWords: 8, value: "too short" }],
  canonicalSectionOrder: plan.map((section) => section.id),
});
assert.equal(insufficient.length, 1);
assert.equal(getCreatorScriptDurationContract({ targetDurationSec: 960, language: "en", actualWordCount: 2029 }).status, "too_short");

const capacityLimitedCounts = [...liveCounts];
capacityLimitedCounts[1] = plan[1].maximumWords - 10;
const capacityLimited = createCreatorScriptAdditiveExpansionPlan({
  script: scriptWithCounts(capacityLimitedCounts),
  plan,
  globalDeficitWords: 10,
});
assert.equal(capacityLimited.length, 1);
assert.equal(capacityLimited[0].sectionId, "section-2");
assert.equal(capacityLimited[0].requestedGainWords, CREATOR_SCRIPT_MIN_ATOMIC_ADDITIVE_GAIN_WORDS);

const noCapacityCounts = plan.map((budget) =>
  budget.kind === "body" ? budget.maximumWords - 19 : budget.targetWords
);
assert.deepEqual(createCreatorScriptAdditiveExpansionPlan({
  script: scriptWithCounts(noCapacityCounts),
  plan,
  globalDeficitWords: 10,
}), []);

const duration = getCreatorScriptDurationContract({ targetDurationSec: 960, language: "en", actualWordCount: 0 });
assert.equal(getCreatorScriptDurationContract({
  targetDurationSec: 960,
  language: "en",
  actualWordCount: duration.maximumAcceptableWordCount + 1,
}).status, "too_long");

console.log("Stage 0.15B.6M residual additive expansion granularity: PASS");
