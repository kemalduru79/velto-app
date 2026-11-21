import assert from "node:assert/strict";

const {
  createCreatorLongFormEvidenceCapabilityEvaluation,
  createCreatorLongFormEvidenceReadiness,
  createCreatorScriptSectionClaimRouting,
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
  section("section-3", "body", ["grounded_synthesis", "evidence_interpretation"]),
  section("section-4", "body", ["counterview", "thesis_stress_test"]),
  section("conclusion", "conclusion", ["highest_order_implication"]),
];

const context = {
  version: "0.10H-2H",
  sourceVersion: "0.10H-2E",
  editorialConstitution: "Preserve evidence and uncertainty.",
  readiness: {
    status: "ready",
    editorialReadinessScore: 90,
    reviewReasons: [],
    primarySourceRequiredClaimIds: [],
    primarySourceCoveredClaimIds: [],
  },
  claims: [
    {
      claimId: "claim-counter",
      claimType: "FACT",
      text: "Counter-bearing claim",
      supportingEvidenceIds: ["e-support-1"],
      counterEvidenceIds: ["e-counter-1"],
      contextualEvidenceIds: [],
    },
    {
      claimId: "claim-2",
      claimType: "FACT",
      text: "Second claim",
      supportingEvidenceIds: ["e-support-2"],
      counterEvidenceIds: [],
      contextualEvidenceIds: [],
    },
    {
      claimId: "claim-3",
      claimType: "RESEARCH_FINDING",
      text: "Third claim",
      supportingEvidenceIds: ["e-support-3"],
      counterEvidenceIds: [],
      contextualEvidenceIds: [],
    },
    {
      claimId: "claim-4",
      claimType: "FACT",
      text: "Fourth claim",
      supportingEvidenceIds: ["e-support-4"],
      counterEvidenceIds: [],
      contextualEvidenceIds: [],
    },
    {
      claimId: "claim-5",
      claimType: "THEORY",
      text: "Uncertainty-bearing claim",
      supportingEvidenceIds: ["e-support-5"],
      counterEvidenceIds: [],
      contextualEvidenceIds: [],
    },
    {
      claimId: "claim-6",
      claimType: "FACT",
      text: "Sixth claim",
      supportingEvidenceIds: ["e-support-6"],
      counterEvidenceIds: [],
      contextualEvidenceIds: [],
    },
  ],
  evidence: [
    { evidenceId: "e-support-1", sourceId: "s1", excerpt: "Supported claim one.", contextNote: null, locator: {} },
    { evidenceId: "e-counter-1", sourceId: "s2", excerpt: "Contradicting evidence for claim one.", contextNote: null, locator: {} },
    { evidenceId: "e-support-2", sourceId: "s3", excerpt: "Supported claim two.", contextNote: null, locator: {} },
    { evidenceId: "e-support-3", sourceId: "s4", excerpt: "Supported claim three.", contextNote: null, locator: {} },
    { evidenceId: "e-support-4", sourceId: "s5", excerpt: "Supported claim four.", contextNote: null, locator: {} },
    { evidenceId: "e-support-5", sourceId: "s6", excerpt: "Supported uncertainty claim.", contextNote: null, locator: {} },
    { evidenceId: "e-support-6", sourceId: "s7", excerpt: "Supported claim six.", contextNote: null, locator: {} },
  ],
  sources: [],
};

const routing = createCreatorScriptSectionClaimRouting({ context, plan });
const counterRoute = routing.find((route) => route.sectionId === "section-4");
assert.ok(counterRoute);
assert.ok(
  counterRoute.claimIds.includes("claim-counter"),
  "counterview section must explicitly receive a claim carrying counter-evidence",
);

const evaluation = createCreatorLongFormEvidenceCapabilityEvaluation({
  context,
  plan,
});
assert.equal(evaluation.counterviewSectionId, "section-4");
assert.equal(
  evaluation.hasCounterviewCapability,
  true,
  "role-aware routing must expose available counter-evidence capability",
);

const readiness = createCreatorLongFormEvidenceReadiness({
  context,
  plan,
  sectionNative: true,
});
assert.equal(
  readiness.reasonCodes.includes("missing_counterview_capability"),
  false,
);

const noCounterContext = {
  ...context,
  claims: context.claims.map((claim) => ({
    ...claim,
    counterEvidenceIds: [],
  })),
};

const noCounterRouting = createCreatorScriptSectionClaimRouting({
  context: noCounterContext,
  plan,
});
const noCounterRoute = noCounterRouting.find((route) => route.sectionId === "section-4");
assert.ok(noCounterRoute);
assert.deepEqual(
  noCounterRoute.claimIds,
  ["claim-4"],
  "without explicit counter authority, section-4 must fall back to its normal modulo-routed claim",
);

const noCounterReadiness = createCreatorLongFormEvidenceReadiness({
  context: noCounterContext,
  plan,
  sectionNative: true,
});
assert.equal(noCounterReadiness.eligible, false);
assert.ok(
  noCounterReadiness.reasonCodes.includes("missing_counterview_capability"),
  "absence of real counter-evidence must still fail the counterview readiness gate",
);

console.log("stage-0-19e6m-counterview-claim-routing-test: PASS");
