import assert from "node:assert/strict";
import { createCreatorEvidenceNarrativeBeatPlan } from "../lib/research/creatorEvidenceNarrativeBeatPlan.ts";
import { buildCreatorSectionEvidencePromptPack } from "../lib/research/creatorEvidencePack.ts";

const locator = { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null };
const source = (id, overrides = {}) => ({
  sourceId: id,
  title: `Synthetic source ${id}`,
  url: `https://example.test/${id}`,
  publisher: "Synthetic Publisher",
  author: null,
  publishedAt: null,
  directness: "primary",
  reviewStatus: "usable",
  searchLane: "academic",
  sourceKind: "paper",
  ...overrides,
});
const evidence = (id, sourceId, excerpt, contextNote = null) => ({
  evidenceId: id,
  sourceId,
  excerpt,
  contextNote,
  locator,
});
const claim = (id, claimType, supportingEvidenceIds, options = {}) => ({
  claimId: id,
  claimType,
  text: `Synthetic claim ${id}`,
  supportingEvidenceIds,
  counterEvidenceIds: options.counterEvidenceIds || [],
  contextualEvidenceIds: options.contextualEvidenceIds || [],
});
const section = (id, kind, owns) => ({
  id,
  kind,
  ownershipBoundary: { usage: "control_only_never_narrate", owns, excludes: [] },
});

const abstract = "A synthetic conceptual account describes a bounded relationship in general terms.";
const concrete = "Researchers assigned 120 synthetic participants to two documented conditions, measured the observed difference, and reported the bounded result.";
const limitation = "The synthetic result applied only under the documented condition and did not establish a universal effect.";
const claims = [
  claim("claim-1", "FACT", ["evidence-1", "evidence-2"]),
  claim("claim-2", "THEORY", ["evidence-3", "evidence-4"]),
  claim("claim-3", "RESEARCH_FINDING", ["evidence-5"], { contextualEvidenceIds: ["evidence-6"] }),
  claim("claim-4", "HYPOTHESIS", ["evidence-7"], { contextualEvidenceIds: ["evidence-8"] }),
  claim("claim-5", "FACT", ["evidence-9"]),
  claim("claim-6", "EDITORIAL_INFERENCE", ["evidence-10"], { contextualEvidenceIds: ["evidence-11"] }),
  claim("claim-7", "RESEARCH_FINDING", ["evidence-12"], { contextualEvidenceIds: ["evidence-13"] }),
];
const evidenceItems = [
  evidence("evidence-1", "source-1", abstract),
  evidence("evidence-2", "source-1", concrete),
  evidence("evidence-3", "source-2", abstract),
  evidence("evidence-4", "source-2", abstract),
  evidence("evidence-5", "source-3", concrete),
  evidence("evidence-6", "source-3-context", limitation),
  evidence("evidence-7", "source-4", abstract),
  evidence("evidence-8", "source-4-context", limitation),
  evidence("evidence-9", "source-5", abstract),
  evidence("evidence-10", "source-blocked", abstract),
  evidence("evidence-11", "source-blocked", limitation),
  evidence("evidence-12", "source-7", concrete),
  evidence("evidence-13", "source-7-context", limitation),
];
const sources = [
  source("source-1"), source("source-2"), source("source-3"), source("source-3-context"),
  source("source-4"), source("source-4-context"), source("source-5"), source("source-blocked"),
  source("source-7"), source("source-7-context"),
];
const context = {
  version: "0.10H-2H",
  sourceVersion: "0.10H-2E",
  editorialConstitution: "Synthetic evidence remains source-bound and uncertainty-qualified.",
  readiness: {
    status: "ready",
    editorialReadinessScore: 100,
    reviewReasons: [],
    primarySourceRequiredClaimIds: [],
    primarySourceCoveredClaimIds: [],
  },
  claims,
  evidence: evidenceItems,
  sources,
};
const originalContext = JSON.stringify(context);
const sections = [
  section("alpha", "opening", ["human_stakes", "master_tension"]),
  section("beta", "body", ["mechanism", "causal_process"]),
  section("gamma", "body", ["grounded_demonstration", "concrete_case"]),
  section("delta", "body", ["counterview", "limits", "scope_conditions"]),
  section("omega", "conclusion", ["highest_order_implication", "unresolved_question"]),
];
const eligibleBySection = new Map([
  ["alpha", ["claim-1", "claim-2"]],
  ["beta", ["claim-1", "claim-2"]],
  ["gamma", ["claim-3", "claim-7"]],
  ["delta", ["claim-4", "claim-5"]],
  ["omega", ["claim-1", "claim-6", "claim-7", "claim-2", "claim-3", "claim-4", "claim-5"]],
]);
const sectionInputs = sections.map((item) => ({
  section: item,
  evidenceSelection: buildCreatorSectionEvidencePromptPack({
    context,
    section: item,
    eligibleClaimIds: eligibleBySection.get(item.id),
  }),
}));

const baselinePrimaryKeys = sectionInputs.map(({ evidenceSelection }) => {
  const unit = evidenceSelection.units[0];
  const binding = unit?.supportingEvidence[0] || unit?.contextualEvidence[0] || unit?.counterEvidence[0];
  return unit && binding ? `${unit.claimId}:${binding.evidenceId}` : null;
}).filter(Boolean);
const baselineDuplicatePrimaryBeatCount = baselinePrimaryKeys.length - new Set(baselinePrimaryKeys).size;
const plan = createCreatorEvidenceNarrativeBeatPlan({
  sections: sectionInputs,
  blockedSourceIds: ["source-blocked"],
});
const repeatedPlan = createCreatorEvidenceNarrativeBeatPlan({
  sections: sectionInputs,
  blockedSourceIds: ["source-blocked"],
});

assert.deepEqual(plan, repeatedPlan, "Beat planning is deterministic");
assert.equal(JSON.stringify(context), originalContext, "Canonical context is not mutated");
assert.equal(plan.advisoryOnly, true);
assert.equal(plan.independentProvenanceVerification, "not_assessed");
assert.equal(plan.semanticAcceptanceClaimed, false);
assert.deepEqual(plan.sections.map((item) => item.sectionId), ["alpha", "beta", "gamma", "delta", "omega"]);
assert.deepEqual(plan.sections.map((item) => item.beatRole), [
  "grounded_human_tension",
  "mechanism",
  "concrete_observed_finding",
  "legitimate_limitation_or_alternate_explanation",
  "earned_implication",
]);
assert.equal(baselineDuplicatePrimaryBeatCount, 1, "A naive first-unit plan repeats the opening beat in the mechanism section");
assert.equal(plan.metrics.duplicatePrimaryBeatCount, 0, "The advisory plan gives primary beats distinct canonical claim/evidence identities");
assert.equal(plan.sections[0].primaryBeat.claimId, "claim-1");
assert.equal(plan.sections[1].primaryBeat.claimId, "claim-2");
assert.equal(plan.sections[2].primaryBeat.claimId, "claim-3");
assert.equal(plan.sections[2].primaryBeat.specificity, "concrete_observation");
assert.equal(plan.sections[2].primaryBeat.stance, "supports");
assert.equal(plan.sections[2].primaryBeat.supportStatus, "canonical_context_eligible");
assert.equal(plan.sections[2].primaryBeat.provenanceVerification, "not_assessed");
assert.equal(plan.sections[3].primaryBeat.claimId, "claim-4");
assert.equal(plan.sections[3].primaryBeat.stance, "contextualizes");
assert.equal(plan.sections[3].primaryBeat.supportStatus, "qualified_uncertainty");
assert.equal(plan.sections[3].primaryBeat.provenanceVerification, "not_assessed");
assert.ok(plan.sections[3].gaps.includes("missing_counterview"), "An absent counterview becomes a gap, not an invented contradiction");
assert.equal(plan.sections.flatMap((item) => [item.primaryBeat, ...item.supportingBeats]).filter(Boolean).some((beat) => beat.stance === "contradicts"), false);
assert.equal(plan.sections[4].primaryBeat.claimId, "claim-7", "A source-blocked implication cannot displace usable canonical evidence");
const blockedBeats = plan.sections.flatMap((item) => item.supportingBeats).filter((beat) => beat.sourceId === "source-blocked");
assert.ok(blockedBeats.length > 0);
assert.ok(blockedBeats.every((beat) =>
  beat.supportStatus === "source_blocked" &&
  beat.provenanceVerification === "source_blocked" &&
  beat.narrativeUse === "blocked"
));
assert.ok(plan.sections[4].gaps.includes("source_provenance_blocked"));
assert.equal(plan.metrics.sourceBlockedBeatCount, blockedBeats.length);
assert.equal(plan.metrics.missingCounterviewCount, 1);
assert.equal(plan.metrics.candidatePrimaryBeatCount, 5);
assert.equal(plan.metrics.canonicalContextEligiblePrimaryBeatCount, 5);
assert.equal(plan.metrics.candidateConcretePrimaryBeatCount, 2);
assert.equal(plan.metrics.independentlyProvenanceVerifiedPrimaryBeatCount, 0);
assert.equal(plan.metrics.independentlyProvenanceVerifiedConcretePrimaryBeatCount, 0);
assert.equal(plan.metrics.genericSupportOnlyCount, 3);
assert.equal(plan.metrics.omittedByBudgetCount, 2, "Stage 5A unit-budget omissions remain visible");
assert.ok(plan.progression.every((item) => item.distinctFromPrevious));
assert.deepEqual(
  plan.sections.flatMap((item) => [item.primaryBeat, ...item.supportingBeats]).filter(Boolean).map((beat) => ({
    claimId: beat.claimId,
    evidenceId: beat.evidenceId,
    sourceId: beat.sourceId,
  })).every((identity) =>
    claims.some((item) => item.claimId === identity.claimId) &&
    evidenceItems.some((item) => item.evidenceId === identity.evidenceId && item.sourceId === identity.sourceId)
  ),
  true,
  "Every beat retains canonical claim/evidence/source identity",
);

const blockedOnlySection = section("blocked-only", "body", ["grounded_demonstration"]);
const blockedOnlyPlan = createCreatorEvidenceNarrativeBeatPlan({
  sections: [{
    section: blockedOnlySection,
    evidenceSelection: buildCreatorSectionEvidencePromptPack({
      context,
      section: blockedOnlySection,
      eligibleClaimIds: ["claim-6"],
    }),
  }],
  blockedSourceIds: ["source-blocked"],
});
assert.equal(blockedOnlyPlan.sections[0].primaryBeat, null);
assert.equal(blockedOnlyPlan.metrics.candidatePrimaryBeatCount, 0);
assert.equal(blockedOnlyPlan.metrics.canonicalContextEligiblePrimaryBeatCount, 0);
assert.equal(blockedOnlyPlan.metrics.candidateConcretePrimaryBeatCount, 0);
assert.equal(blockedOnlyPlan.metrics.independentlyProvenanceVerifiedPrimaryBeatCount, 0);
assert.ok(blockedOnlyPlan.sections[0].gaps.includes("unsupported_narrative_opportunity"));
assert.ok(blockedOnlyPlan.sections[0].gaps.includes("source_provenance_blocked"));
assert.ok(blockedOnlyPlan.sections[0].gaps.includes("missing_concrete_observation"));

const conceptualOnlySection = section("conceptual-only", "body", ["grounded_demonstration"]);
const conceptualOnlyPlan = createCreatorEvidenceNarrativeBeatPlan({
  sections: [{
    section: conceptualOnlySection,
    evidenceSelection: buildCreatorSectionEvidencePromptPack({
      context,
      section: conceptualOnlySection,
      eligibleClaimIds: ["claim-5"],
    }),
  }],
});
assert.equal(conceptualOnlyPlan.metrics.candidatePrimaryBeatCount, 1);
assert.equal(conceptualOnlyPlan.metrics.candidateConcretePrimaryBeatCount, 0);
assert.equal(conceptualOnlyPlan.metrics.independentlyProvenanceVerifiedPrimaryBeatCount, 0);
assert.ok(conceptualOnlyPlan.sections[0].gaps.includes("missing_concrete_observation"));
assert.ok(conceptualOnlyPlan.sections[0].gaps.includes("generic_support_only"));

const noCounterEvidenceSection = section("no-counterevidence", "body", ["counterview", "limits"]);
const noCounterEvidencePlan = createCreatorEvidenceNarrativeBeatPlan({
  sections: [{
    section: noCounterEvidenceSection,
    evidenceSelection: buildCreatorSectionEvidencePromptPack({
      context,
      section: noCounterEvidenceSection,
      eligibleClaimIds: ["claim-4"],
    }),
  }],
});
assert.ok(noCounterEvidencePlan.sections[0].gaps.includes("missing_counterview"));
assert.equal(
  [noCounterEvidencePlan.sections[0].primaryBeat, ...noCounterEvidencePlan.sections[0].supportingBeats]
    .filter(Boolean)
    .some((beat) => beat.stance === "contradicts"),
  false,
  "Absent counterevidence remains an explicit gap rather than an inferred counterclaim",
);

const beatMapSummary = plan.sections.map((item) => ({
  sectionId: item.sectionId,
  beatRole: item.beatRole,
  primaryClaimId: item.primaryBeat?.claimId || null,
  primaryEvidenceId: item.primaryBeat?.evidenceId || null,
  primarySpecificity: item.primaryBeat?.specificity || null,
  primarySupportStatus: item.primaryBeat?.supportStatus || null,
  gaps: item.gaps,
}));
console.log("STAGE_5B_SYNTHETIC_BEAT_MAP", JSON.stringify({
  baseline: {
    concretePrimaryBeatCount: 1,
    duplicatePrimaryBeatCount: baselineDuplicatePrimaryBeatCount,
  },
  prototype: plan.metrics,
  progression: beatMapSummary,
}, null, 2));
console.log("STAGE_5B_EVIDENCE_NARRATIVE_BEAT_PLAN=PASS");
