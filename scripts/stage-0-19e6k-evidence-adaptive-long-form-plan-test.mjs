import assert from "node:assert/strict";

const {
  adaptCreatorLongFormSectionPlanToEvidenceCapability,
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
    minimumWords: kind === "body" ? 285 : 111,
    targetWords: kind === "body" ? 317 : 124,
    maximumWords: kind === "body" ? 349 : 137,
  };
}

const plan = [
  section("opening", "opening", ["human_stakes"]),
  section("section-1", "body", ["definition", "framing"]),
  section("section-2", "body", ["mechanism", "causal_process"]),
  section("section-3", "body", ["grounded_demonstration", "concrete_case"]),
  section("section-4", "body", ["limits", "uncertainty"]),
  section("conclusion", "conclusion", ["highest_order_implication"]),
];

const evidence = [
  { evidenceId: "e1", sourceId: "s1", excerpt: "Many jobs may lack social usefulness or meaning.", contextNote: null, locator: {} },
  { evidenceId: "e2", sourceId: "s2", excerpt: "Post-work proposals face criticism about political solidarity.", contextNote: null, locator: {} },
  { evidenceId: "e3", sourceId: "s3", excerpt: "Work can provide skill development, purpose, achievement, sociality, and relatedness.", contextNote: null, locator: {} },
  { evidenceId: "e4", sourceId: "s4", excerpt: "Unemployment can affect well-being beyond the loss of income.", contextNote: null, locator: {} },
  { evidenceId: "e5", sourceId: "s5", excerpt: "Meaning does not necessarily depend on traditional paid work.", contextNote: null, locator: {} },
];

const context = {
  version: "0.10H-2H",
  sourceVersion: "0.10H-2E",
  editorialConstitution: "Preserve evidence and uncertainty.",
  readiness: {
    status: "review",
    editorialReadinessScore: 80,
    reviewReasons: [],
    primarySourceRequiredClaimIds: [],
    primarySourceCoveredClaimIds: [],
  },
  claims: [
    { claimId: "c1", claimType: "RESEARCH_FINDING", text: "c1", supportingEvidenceIds: ["e1"], counterEvidenceIds: [], contextualEvidenceIds: [] },
    { claimId: "c2", claimType: "EDITORIAL_INFERENCE", text: "c2", supportingEvidenceIds: ["e2"], counterEvidenceIds: [], contextualEvidenceIds: [] },
    { claimId: "c3", claimType: "RESEARCH_FINDING", text: "c3", supportingEvidenceIds: ["e3"], counterEvidenceIds: [], contextualEvidenceIds: [] },
    { claimId: "c4", claimType: "RESEARCH_FINDING", text: "c4", supportingEvidenceIds: ["e4"], counterEvidenceIds: [], contextualEvidenceIds: [] },
    { claimId: "c5", claimType: "THEORY", text: "c5", supportingEvidenceIds: ["e5"], counterEvidenceIds: [], contextualEvidenceIds: [] },
  ],
  evidence,
  sources: [],
};

const before = createCreatorLongFormEvidenceReadiness({
  context,
  plan,
  sectionNative: true,
});
assert.deepEqual(
  before.reasonCodes,
  ["missing_grounded_demonstration_capability"],
  "abstract-only evidence should block the concrete demonstration role before adaptation",
);

const adapted = adaptCreatorLongFormSectionPlanToEvidenceCapability({
  context,
  plan,
});

assert.equal(adapted.length, plan.length);
assert.deepEqual(
  adapted.map(({ id, kind, minimumWords, targetWords, maximumWords }) => ({
    id, kind, minimumWords, targetWords, maximumWords,
  })),
  plan.map(({ id, kind, minimumWords, targetWords, maximumWords }) => ({
    id, kind, minimumWords, targetWords, maximumWords,
  })),
  "adaptation must preserve section identity, order, kind, and word budgets",
);

const adaptedDemo = adapted.find((item) => item.id === "section-3");
assert.ok(adaptedDemo);
assert.deepEqual(
  adaptedDemo.ownershipBoundary.owns,
  ["grounded_synthesis", "evidence_interpretation"],
);
assert.match(adaptedDemo.role, /Synthesize the strongest grounded findings/u);
assert.doesNotMatch(
  JSON.stringify(adaptedDemo),
  /invent a concrete case|demonstrate the mechanism through the strongest grounded evidence or case/u,
);

const after = createCreatorLongFormEvidenceReadiness({
  context,
  plan: adapted,
  sectionNative: true,
});
assert.equal(after.eligible, true);
assert.deepEqual(after.reasonCodes, []);

const concreteContext = {
  ...context,
  evidence: context.evidence.map((item) =>
    item.evidenceId === "e3"
      ? {
          ...item,
          excerpt:
            "Workers were surveyed before and after automation adoption, and reported job satisfaction decreased by 20 percent.",
        }
      : item
  ),
};
const concreteEvaluation = createCreatorLongFormEvidenceCapabilityEvaluation({
  context: concreteContext,
  plan,
});
assert.equal(concreteEvaluation.hasGroundedDemonstrationCapability, true);

const concretePlan = adaptCreatorLongFormSectionPlanToEvidenceCapability({
  context: concreteContext,
  plan,
});
assert.equal(
  concretePlan,
  plan,
  "a genuine concrete observation must preserve the canonical demonstration role",
);

const noUncertaintyContext = {
  ...context,
  claims: context.claims.map((claim) =>
    claim.claimId === "c2" || claim.claimId === "c5"
      ? { ...claim, claimType: "FACT" }
      : claim
  ),
};
const noUncertaintyPlan = adaptCreatorLongFormSectionPlanToEvidenceCapability({
  context: noUncertaintyContext,
  plan,
});
const noUncertaintyReadiness = createCreatorLongFormEvidenceReadiness({
  context: noUncertaintyContext,
  plan: noUncertaintyPlan,
  sectionNative: true,
});
assert.equal(noUncertaintyReadiness.eligible, false);
assert.ok(
  noUncertaintyReadiness.reasonCodes.includes("missing_uncertainty_capability"),
  "adaptation must not suppress unrelated long-form readiness blockers",
);

console.log("stage-0-19e6k-evidence-adaptive-long-form-plan-test: PASS");
