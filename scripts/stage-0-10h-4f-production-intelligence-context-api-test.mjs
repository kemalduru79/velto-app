import assert from "node:assert/strict";
import fs from "node:fs";
import {
  normalizeCreatorProductionIntelligenceScenes,
} from "../lib/creator/productionIntelligenceRequest.ts";

const [scene] = normalizeCreatorProductionIntelligenceScenes([{
  id: 7,
  text: "  Evidence   scene  ",
  contentNature: "data",
  documentarySourceContext: {
    version: "malicious-client-version",
    sourceReferenceCount: 4,
    routingCandidateCount: 3,
    sourceClipCandidateCount: 2,
    sourceImageCandidateCount: 5,
    primarySourceClipCandidateCount: 9,
    primarySourceImageCandidateCount: 9,
    rightsReviewRequiredCount: 20,
    excludedCount: 20,
    candidates: [{
      sourceUrl: "https://private.example/source",
      researchSourceId: "claim-linked-source",
      providerRequestId: "secret",
    }],
  },
  evidenceVisualContext: {
    version: "client-version",
    sceneId: "wrong-scene",
    statementCount: 2,
    traceableStatementCount: 1,
    supportingEvidenceCount: 1,
    supportingSourceCount: 1,
    factClaimCount: 1,
    researchFindingClaimCount: 0,
    primarySourceClaimCount: 0,
    expertOpinionClaimCount: 0,
    dataVisualCandidate: true,
    quoteCardCandidate: true,
    sourceCardCandidate: true,
    quoteCardRequiresReview: false,
    claimId: "claim-1",
    excerpt: "raw quote",
    providerName: "provider",
  },
}]);

assert.equal(scene.id, 7);
assert.equal(scene.text, "Evidence scene");
assert.deepEqual(scene.documentarySourceContext, {
  version: "0.10H-4B",
  sourceReferenceCount: 4,
  routingCandidateCount: 3,
  sourceClipCandidateCount: 2,
  sourceImageCandidateCount: 1,
  primarySourceClipCandidateCount: 2,
  primarySourceImageCandidateCount: 1,
  rightsReviewRequiredCount: 3,
  excludedCount: 1,
  candidates: [],
});
assert.deepEqual(scene.evidenceVisualContext, {
  version: "0.10H-4D",
  sceneId: "7",
  statementCount: 2,
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
});
assert.doesNotMatch(JSON.stringify(scene), /private\.example|claim-linked-source|providerRequestId|raw quote|providerName|claim-1/);

const [inconsistent] = normalizeCreatorProductionIntelligenceScenes([{
  id: 8,
  evidenceVisualContext: {
    statementCount: 3,
    traceableStatementCount: 0,
    supportingEvidenceCount: 0,
    supportingSourceCount: 0,
    primarySourceClaimCount: 2,
    quoteCardCandidate: true,
    sourceCardCandidate: true,
    dataVisualCandidate: true,
  },
}]);
assert.equal(inconsistent.evidenceVisualContext?.quoteCardCandidate, false);
assert.equal(inconsistent.evidenceVisualContext?.sourceCardCandidate, false);
assert.equal(inconsistent.evidenceVisualContext?.dataVisualCandidate, false);
assert.equal(inconsistent.evidenceVisualContext?.quoteCardRequiresReview, false);

const [legacy] = normalizeCreatorProductionIntelligenceScenes([{
  id: 9,
  text: "Legacy scene",
  renderMode: "video",
  imageCurrent: false,
  videoCurrent: true,
}]);
assert.equal(legacy.documentarySourceContext, undefined);
assert.equal(legacy.evidenceVisualContext, undefined);
assert.equal(legacy.renderMode, "video");
assert.equal(legacy.imageCurrent, false);
assert.equal(legacy.videoCurrent, true);

assert.deepEqual(normalizeCreatorProductionIntelligenceScenes([{ id: 0 }, null, "bad"]), []);

const normalizer = fs.readFileSync("lib/creator/productionIntelligenceRequest.ts", "utf8");
assert.doesNotMatch(normalizer, /sourceUrl|researchSourceId|claimId|evidenceId|excerpt|providerRequestId|rawProviderPayload/);

const route = fs.readFileSync("app/api/creator-production-intelligence/route.ts", "utf8");
assert.match(route, /normalizeCreatorProductionIntelligenceScenes\(body\.scenes\)/);
assert.match(route, /persistEconomicOperationBestEffort/);
assert.doesNotMatch(route, /documentarySourceContext\s*:/);
assert.doesNotMatch(route, /evidenceVisualContext\s*:/);
assert.doesNotMatch(route, /sourceUrl|claimId|evidenceId|excerpt|providerRequestId|rawProviderPayload/);

console.log("Stage 0.10H-4F Production Intelligence context API tests passed.");
