import assert from "node:assert/strict";
import { planCreatorSceneProduction } from "../lib/creator/productionIntelligence.ts";

const evidenceContext = (overrides = {}) => ({
  version: "0.10H-4D",
  sceneId: "1",
  statementCount: 1,
  traceableStatementCount: 1,
  supportingEvidenceCount: 1,
  supportingSourceCount: 1,
  factClaimCount: 1,
  researchFindingClaimCount: 0,
  primarySourceClaimCount: 0,
  expertOpinionClaimCount: 0,
  dataVisualCandidate: false,
  quoteCardCandidate: false,
  sourceCardCandidate: false,
  quoteCardRequiresReview: false,
  ...overrides,
});

const dataVisual = planCreatorSceneProduction({
  id: 1,
  text: "Measured evidence is presented.",
  sceneRole: "evidence",
  contentNature: "data",
  evidenceVisualContext: evidenceContext({ dataVisualCandidate: true }),
}, "standard");
assert.equal(dataVisual.selectedTreatment, "data_visual");
assert.deepEqual(dataVisual.reasonCodes, ["TRACEABLE_EVIDENCE_VISUAL", "DATA_OR_FINDING_AVAILABLE"]);
assert.equal(dataVisual.expectedPaidGeneration, false);
assert.equal(dataVisual.expectedCreditOperation, "none");
assert.equal(dataVisual.providerCostCategory, "not_billable");

const quoteCard = planCreatorSceneProduction({
  id: 2,
  text: "An expert statement is used as evidence.",
  sceneRole: "evidence",
  contentNature: "mixed",
  evidenceVisualContext: evidenceContext({
    factClaimCount: 0,
    expertOpinionClaimCount: 1,
    quoteCardCandidate: true,
    quoteCardRequiresReview: true,
  }),
}, "standard");
assert.equal(quoteCard.selectedTreatment, "quote_card");
assert.deepEqual(quoteCard.reasonCodes, ["TRACEABLE_QUOTE_CANDIDATE", "REQUIRES_GOVERNANCE_REVIEW"]);
assert.equal(quoteCard.expectedPaidGeneration, false);
assert.equal(quoteCard.expectedCreditOperation, "none");

const sourceCard = planCreatorSceneProduction({
  id: 3,
  text: "The supporting source is shown.",
  sceneRole: "evidence",
  contentNature: "mixed",
  evidenceVisualContext: evidenceContext({
    factClaimCount: 0,
    sourceCardCandidate: true,
  }),
}, "standard");
assert.equal(sourceCard.selectedTreatment, "source_card");
assert.deepEqual(sourceCard.reasonCodes, ["TRACEABLE_SOURCE_CONTEXT"]);
assert.equal(sourceCard.providerCostCategory, "not_billable");

const primarySourceWins = planCreatorSceneProduction({
  id: 4,
  text: "The real person gives the primary evidence.",
  sceneRole: "evidence",
  contentNature: "person",
  documentarySourceContext: {
    version: "0.10H-4B",
    sourceReferenceCount: 1,
    routingCandidateCount: 1,
    sourceClipCandidateCount: 1,
    sourceImageCandidateCount: 0,
    primarySourceClipCandidateCount: 1,
    primarySourceImageCandidateCount: 0,
    rightsReviewRequiredCount: 1,
    excludedCount: 0,
    candidates: [],
  },
  evidenceVisualContext: evidenceContext({ dataVisualCandidate: true }),
}, "standard");
assert.equal(primarySourceWins.selectedTreatment, "source_clip");

const explicitOverrideWins = planCreatorSceneProduction({
  id: 5,
  text: "Evidence scene with an explicit creator choice.",
  sceneRole: "evidence",
  contentNature: "data",
  renderMode: "image",
  motionImportance: 0.1,
  evidenceVisualContext: evidenceContext({ dataVisualCandidate: true }),
}, "standard");
assert.notEqual(explicitOverrideWins.selectedTreatment, "data_visual");
assert.equal(explicitOverrideWins.overrideState, "user_forced_image");

const noContext = planCreatorSceneProduction({
  id: 6,
  text: "Evidence words alone must not create a chart.",
  sceneRole: "evidence",
  contentNature: "data",
}, "standard");
assert.notEqual(noContext.selectedTreatment, "data_visual");
assert.notEqual(noContext.selectedTreatment, "quote_card");
assert.notEqual(noContext.selectedTreatment, "source_card");
assert.equal(noContext.scores.data_visual, 0);
assert.equal(noContext.scores.quote_card, 0);
assert.equal(noContext.scores.source_card, 0);

console.log("Stage 0.10H-4E evidence visual routing tests passed.");
