import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CREATOR_PRODUCTION_TREATMENTS,
  planCreatorSceneProduction,
} from "../lib/creator/productionIntelligence.ts";
import { normalizeCreatorProductionIntelligenceScenes } from "../lib/creator/productionIntelligenceRequest.ts";

const documentaryTreatments = [
  "source_clip",
  "source_image",
  "data_visual",
  "quote_card",
  "source_card",
];

assert.deepEqual([...CREATOR_PRODUCTION_TREATMENTS], [
  "reuse_existing",
  "stock_photo",
  "stock_video",
  "ai_image",
  "image_motion",
  "ai_video",
  ...documentaryTreatments,
]);

const sourceContext = {
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
};

const authenticSource = planCreatorSceneProduction({
  id: 1,
  sceneRole: "evidence",
  contentNature: "person",
  authenticityValue: 0.95,
  motionImportance: 0.5,
  documentarySourceContext: sourceContext,
}, "standard");
assert.equal(authenticSource.selectedTreatment, "source_clip");
assert.equal(authenticSource.expectedPaidGeneration, false);
assert.equal(authenticSource.expectedCreditOperation, "none");
assert.equal(authenticSource.providerCostCategory, "not_billable");
assert.ok(authenticSource.reasonCodes.includes("PRIMARY_SOURCE_AVAILABLE"));

const existingAsset = planCreatorSceneProduction({
  id: 2,
  contentNature: "person",
  assetPreserved: true,
  image: "https://assets.example.com/current.jpg",
  documentarySourceContext: sourceContext,
}, "standard");
assert.equal(existingAsset.selectedTreatment, "reuse_existing");
assert.equal(existingAsset.overrideState, "existing_asset_preserved");

const explicitOverride = planCreatorSceneProduction({
  id: 3,
  contentNature: "person",
  renderMode: "image",
  documentarySourceContext: sourceContext,
}, "standard");
assert.equal(explicitOverride.overrideState, "user_forced_image");
assert.notEqual(explicitOverride.selectedTreatment, "source_clip");

const evidenceContext = {
  version: "0.10H-4D",
  sceneId: "4",
  statementCount: 1,
  traceableStatementCount: 1,
  supportingEvidenceCount: 1,
  supportingSourceCount: 1,
  factClaimCount: 1,
  researchFindingClaimCount: 0,
  primarySourceClaimCount: 0,
  expertOpinionClaimCount: 0,
  dataVisualCandidate: true,
  quoteCardCandidate: false,
  sourceCardCandidate: true,
  quoteCardRequiresReview: false,
};
const evidenceVisual = planCreatorSceneProduction({
  id: 4,
  sceneRole: "evidence",
  contentNature: "data",
  evidenceVisualContext: evidenceContext,
}, "standard");
assert.equal(evidenceVisual.selectedTreatment, "data_visual");
assert.equal(evidenceVisual.expectedPaidGeneration, false);
assert.equal(evidenceVisual.expectedCreditOperation, "none");
assert.equal(evidenceVisual.providerCostCategory, "not_billable");

const quoteCandidate = planCreatorSceneProduction({
  id: 5,
  sceneRole: "evidence",
  evidenceVisualContext: {
    ...evidenceContext,
    sceneId: "5",
    factClaimCount: 0,
    primarySourceClaimCount: 1,
    dataVisualCandidate: false,
    quoteCardCandidate: true,
    quoteCardRequiresReview: true,
  },
}, "standard");
assert.equal(quoteCandidate.selectedTreatment, "quote_card");
assert.ok(quoteCandidate.reasonCodes.includes("REQUIRES_GOVERNANCE_REVIEW"));
assert.equal(quoteCandidate.expectedPaidGeneration, false);

const sanitizedScenes = normalizeCreatorProductionIntelligenceScenes([{
  id: 7,
  documentarySourceContext: {
    ...sourceContext,
    candidates: [{
      researchSourceId: "source-secret",
      title: "Secret source",
      sourceUrl: "https://example.com/raw-source",
      sourceMediaKind: "video",
      rightsState: "review_required",
      directness: "primary",
      reviewStatus: "review",
      routingStatus: "review_required",
    }],
    sourceUrl: "https://example.com/should-drop",
    providerMetadata: { requestId: "provider-secret" },
  },
  evidenceVisualContext: {
    ...evidenceContext,
    sceneId: "7",
    claimId: "claim-secret",
    evidenceId: "evidence-secret",
    excerpt: "raw evidence excerpt",
  },
}]);
assert.equal(sanitizedScenes.length, 1);
assert.deepEqual(sanitizedScenes[0].documentarySourceContext?.candidates, []);
const sanitizedJson = JSON.stringify(sanitizedScenes[0]);
for (const forbidden of [
  "raw-source",
  "should-drop",
  "provider-secret",
  "claim-secret",
  "evidence-secret",
  "raw evidence excerpt",
]) {
  assert.equal(sanitizedJson.includes(forbidden), false, `Backstage PI payload leaked ${forbidden}`);
}

const sceneAssembly = fs.readFileSync("lib/creator/sceneDocumentaryContext.ts", "utf8");
assert.match(sceneAssembly, /traceabilityStatus\s*===\s*["']traceable["']/);
assert.match(sceneAssembly, /supportingSourceIds/);
assert.match(sceneAssembly, /sceneReferences\s*=\s*input\.sourceReferences\.filter/);
assert.match(sceneAssembly, /global research pool is never[\s\S]*?copied wholesale/i);

const pipeline = fs.readFileSync("lib/research/creatorEditorialPipeline.client.ts", "utf8");
assert.match(pipeline, /productionIntelligenceContexts/);
assert.match(pipeline, /normalizeCreatorDocumentarySourcePlanningContext/);
assert.match(pipeline, /normalizeCreatorEvidenceVisualPlanningContext/);
assert.doesNotMatch(pipeline, /providerRequestId|rawProviderPayload/);

const createPage = fs.readFileSync("app/create/page.tsx", "utf8");
assert.match(createPage, /creatorProductionIntelligenceContextsRef/);
assert.match(createPage, /documentarySourceContext:\s*context\.documentarySourceContext/);
assert.match(createPage, /evidenceVisualContext:\s*context\.evidenceVisualContext/);
assert.match(createPage, /fetch\(["']\/api\/creator-production-intelligence["']/);
assert.equal((createPage.match(/fetch\(["']\/api\/creator-script-plan/g) || []).length, 0);
assert.doesNotMatch(
  createPage,
  />\s*(?:Documentary source|Evidence visual|Source evidence|Provider)\s*</i,
  "H-4 internals must remain backstage rather than becoming a new UI surface",
);

console.log("Stage 0.10H-4J Documentary Production Intelligence closure tests passed.");
