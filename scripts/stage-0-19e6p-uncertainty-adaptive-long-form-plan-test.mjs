import assert from "node:assert/strict";

const {
  adaptCreatorLongFormSectionPlanToUncertaintyCapability,
  createCreatorLongFormEvidenceCapabilityEvaluation,
  createCreatorLongFormEvidenceReadiness,
} = await import("../lib/research/creatorLongFormEvidenceReadiness.ts");

function section(id, kind, owns) {
  return {
    id,
    kind,
    role: `role-${id}`,
    centralQuestion: `question-${id}`,
    progression: `progression-${id}`,
    ownershipBoundary: {
      usage: "control_only_never_narrate",
      owns,
      excludes: ["prior_work"],
    },
    minimumWords: kind === "body" ? 285 : kind === "opening" ? 111 : 143,
    targetWords: kind === "body" ? 317 : kind === "opening" ? 124 : 159,
    maximumWords: kind === "body" ? 349 : kind === "opening" ? 137 : 175,
  };
}

const plan = [
  section("opening", "opening", ["human_stakes"]),
  section("section-1", "body", ["definition", "framing"]),
  section("section-2", "body", ["mechanism", "causal_process"]),
  section("section-3", "body", ["grounded_synthesis", "evidence_interpretation"]),
  section("section-4", "body", ["limits", "uncertainty", "scope_conditions"]),
  section("conclusion", "conclusion", ["highest_order_implication"]),
];

const claims = [1, 2, 3, 4].map((n) => ({
  claimId: `claim-${n}`,
  claimType: "FACT",
  text: `Supported fact ${n}`,
  supportingEvidenceIds: [`e-${n}`],
  counterEvidenceIds: [],
  contextualEvidenceIds: [],
}));

const context = {
  version: "0.10H-2H",
  sourceVersion: "0.10H-2E",
  editorialConstitution: "Ground factual claims and do not invent uncertainty.",
  readiness: {
    status: "ready",
    editorialReadinessScore: 90,
    reviewReasons: [],
    primarySourceRequiredClaimIds: [],
    primarySourceCoveredClaimIds: [],
  },
  claims,
  evidence: [1, 2, 3, 4].map((n) => ({
    evidenceId: `e-${n}`,
    sourceId: `s-${n}`,
    excerpt: `Supported evidence ${n}.`,
    contextNote: null,
    locator: {},
  })),
  sources: [],
};

const before = createCreatorLongFormEvidenceCapabilityEvaluation({
  context,
  plan,
});
assert.equal(before.limitsSectionId, "section-4");
assert.equal(before.hasUncertaintyCapability, false);

const beforeReadiness = createCreatorLongFormEvidenceReadiness({
  context,
  plan,
  sectionNative: true,
});
assert.ok(
  beforeReadiness.reasonCodes.includes("missing_uncertainty_capability"),
);

const adapted = adaptCreatorLongFormSectionPlanToUncertaintyCapability({
  context,
  plan,
});
assert.notEqual(adapted, plan);
assert.equal(adapted.length, plan.length);

for (let index = 0; index < plan.length; index += 1) {
  assert.equal(adapted[index].id, plan[index].id);
  assert.equal(adapted[index].kind, plan[index].kind);
  assert.equal(adapted[index].minimumWords, plan[index].minimumWords);
  assert.equal(adapted[index].targetWords, plan[index].targetWords);
  assert.equal(adapted[index].maximumWords, plan[index].maximumWords);
  if (plan[index].id !== "section-4") {
    assert.equal(adapted[index], plan[index]);
  }
}

const adaptedLimits = adapted.find((item) => item.id === "section-4");
assert.ok(adaptedLimits);
assert.deepEqual(
  adaptedLimits.ownershipBoundary.owns,
  ["grounded_tension", "evidence_boundary"],
);
assert.ok(adaptedLimits.ownershipBoundary.excludes.includes("invented_uncertainty"));
assert.ok(adaptedLimits.ownershipBoundary.excludes.includes("unsupported_scope_condition"));

const after = createCreatorLongFormEvidenceReadiness({
  context,
  plan: adapted,
  sectionNative: true,
});
assert.equal(
  after.reasonCodes.includes("missing_uncertainty_capability"),
  false,
);
assert.equal(after.eligible, true);

const uncertaintyContext = {
  ...context,
  claims: context.claims.map((claim, index) =>
    index === 3
      ? {
          ...claim,
          claimType: "THEORY",
        }
      : claim
  ),
};

const withUncertainty = createCreatorLongFormEvidenceCapabilityEvaluation({
  context: uncertaintyContext,
  plan,
});
assert.equal(withUncertainty.hasUncertaintyCapability, true);

const unchanged = adaptCreatorLongFormSectionPlanToUncertaintyCapability({
  context: uncertaintyContext,
  plan,
});
assert.equal(unchanged, plan);

console.log("stage-0-19e6p-uncertainty-adaptive-long-form-plan-test: PASS");
