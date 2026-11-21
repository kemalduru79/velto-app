import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  createCreatorScriptBuildScriptRepairInput,
} = await import("../lib/creator/creatorScriptBuildScriptRepairCoordinator.ts");

const words = (count) =>
  Array.from({ length: count }, (_, index) => `word${index + 1}`).join(" ");

const sectionPlan = [
  { id: "opening", kind: "opening", role: "opening", centralQuestion: "q", progression: "p", ownershipBoundary: { usage: "control_only_never_narrate", owns: ["human_stakes"], excludes: ["mechanism"] }, minimumWords: 111, targetWords: 124, maximumWords: 137 },
  { id: "section-1", kind: "body", role: "definition", centralQuestion: "q", progression: "p", ownershipBoundary: { usage: "control_only_never_narrate", owns: ["definition"], excludes: ["mechanism"] }, minimumWords: 285, targetWords: 317, maximumWords: 349 },
  { id: "section-2", kind: "body", role: "mechanism", centralQuestion: "q", progression: "p", ownershipBoundary: { usage: "control_only_never_narrate", owns: ["mechanism"], excludes: ["limits"] }, minimumWords: 285, targetWords: 317, maximumWords: 349 },
  { id: "section-3", kind: "body", role: "evidence", centralQuestion: "q", progression: "p", ownershipBoundary: { usage: "control_only_never_narrate", owns: ["grounded_demonstration"], excludes: ["limits"] }, minimumWords: 285, targetWords: 317, maximumWords: 349 },
  { id: "section-4", kind: "body", role: "limits", centralQuestion: "q", progression: "p", ownershipBoundary: { usage: "control_only_never_narrate", owns: ["limits"], excludes: ["mechanism"] }, minimumWords: 285, targetWords: 317, maximumWords: 349 },
  { id: "conclusion", kind: "conclusion", role: "conclusion", centralQuestion: "q", progression: "p", ownershipBoundary: { usage: "control_only_never_narrate", owns: ["unresolved_question"], excludes: ["definition"] }, minimumWords: 143, targetWords: 159, maximumWords: 175 },
];

const counts = {
  opening: 149,
  "section-1": 191,
  "section-2": 334,
  "section-3": 218,
  "section-4": 211,
  conclusion: 170,
};

const script = {
  version: 1,
  title: "Life Without Work",
  sections: sectionPlan.map((budget) => ({
    id: budget.id,
    kind: budget.kind,
    heading: budget.id,
    text: words(counts[budget.id]),
    claimIds: ["claim-1"],
    evidenceReviewRequired: false,
  })),
  targetDurationSec: 660,
  strategyFingerprint: "creator-strategy-v1-test",
  revision: 1,
  grounding: {
    context: {
      version: "0.10H-2H",
      sourceVersion: "0.10H-2E",
      editorialConstitution: "Ground claims.",
      readiness: {
        status: "review",
        editorialReadinessScore: 80,
        reviewReasons: [],
        primarySourceRequiredClaimIds: [],
        primarySourceCoveredClaimIds: [],
      },
      claims: [{
        claimId: "claim-1",
        claimType: "FACT",
        text: "Grounded claim.",
        supportingEvidenceIds: [],
        counterEvidenceIds: [],
        contextualEvidenceIds: [],
      }],
      evidence: [],
      sources: [],
    },
  },
  approval: null,
  generatedAt: "2026-10-03T00:00:00.000Z",
  updatedAt: "2026-10-03T00:00:00.000Z",
};

const diagnostics = sectionPlan.map((budget) => ({
  id: budget.id,
  kind: budget.kind,
  role: budget.role,
  minimumWords: budget.minimumWords,
  targetWords: budget.targetWords,
  maximumWords: budget.maximumWords,
  actualWords: counts[budget.id],
  deficitWords: Math.max(0, budget.minimumWords - counts[budget.id]),
  excessWords: Math.max(0, counts[budget.id] - budget.maximumWords),
  missing: false,
}));

const report = {
  version: "0.19D",
  accepted: false,
  repairRequired: true,
  violations: [],
  repairableViolations: [
    {
      code: "GLOBAL_DURATION_TOO_SHORT",
      severity: "hard",
      repairable: true,
      sectionId: null,
      repairStrategy: "expand",
      diagnostics: {
        actualWords: 1273,
        minimumWords: 1396,
        maximumWords: 1706,
        distanceWords: 123,
      },
    },
    {
      code: "SECTION_OVER_MAX",
      severity: "hard",
      repairable: true,
      sectionId: "opening",
      repairStrategy: "compress",
      diagnostics: {
        actualWords: 149,
        maximumWords: 137,
        excessWords: 12,
      },
    },
  ],
  blockingViolations: [],
  repairSectionIds: ["opening", "section-1", "section-3", "section-4"],
  duration: {
    status: "too_short",
    targetDurationSec: 660,
    estimatedDurationSec: 541.7,
    actualWordCount: 1273,
    targetWordCount: 1551,
    minimumAcceptableWordCount: 1396,
    maximumAcceptableWordCount: 1706,
    durationRatio: 0.821,
    varianceSec: -118.3,
    wordsPerSecond: 2.35,
  },
  sections: diagnostics,
};

const snapshot = {
  strategy: {
    topic: "If work becomes optional",
    title: "Life Without Work",
    approvedStrategy: { direction: "documentary" },
  },
};

const repairInput = createCreatorScriptBuildScriptRepairInput({
  snapshot,
  script,
  sectionPlan,
  report,
  attempt: 1,
});

assert.equal(repairInput.mode, "replacement");
assert.deepEqual(
  repairInput.replacementTargets.map((target) => [target.sectionId, target.direction]),
  [
    ["opening", "compress"],
    ["section-1", "expand"],
    ["section-3", "expand"],
    ["section-4", "expand"],
  ],
  "mixed rebalance must expose a deterministic local direction for every target",
);
assert.equal(repairInput.replacementTargets[0].minimumRequiredReduction, 12);
assert.equal(repairInput.replacementTargets[1].minimumRequiredGain, 94);
assert.equal(repairInput.replacementTargets[2].minimumRequiredGain, 67);
assert.equal(repairInput.replacementTargets[3].minimumRequiredGain, 74);

const providerSource = await readFile(
  new URL("../lib/creator/creatorScriptBuildProviders.server.ts", import.meta.url),
  "utf8",
);
assert.match(
  providerSource,
  /direction=expand means the replacement must be longer than beforeWords/u,
);
assert.match(
  providerSource,
  /direction=compress means it must be shorter than beforeWords/u,
);
assert.match(
  providerSource,
  /Never apply one target's direction to another target\./u,
);

console.log("stage-0-19e6n-target-local-repair-direction-test: PASS");
