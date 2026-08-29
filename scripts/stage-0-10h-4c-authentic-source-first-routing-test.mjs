import assert from "node:assert/strict";
import { planCreatorSceneProduction } from "../lib/creator/productionIntelligence.ts";

const context = (overrides = {}) => ({
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
  ...overrides,
});

const primaryClip = planCreatorSceneProduction({
  id: 1,
  text: "A real person explains the claim in an interview.",
  sceneRole: "evidence",
  contentNature: "person",
  authenticityValue: 0.9,
  motionImportance: 0.5,
  documentarySourceContext: context(),
}, "standard");

assert.equal(primaryClip.selectedTreatment, "source_clip");
assert.deepEqual(primaryClip.reasonCodes, ["AUTHENTIC_SOURCE_AVAILABLE", "PRIMARY_SOURCE_AVAILABLE"]);
assert.equal(primaryClip.expectedPaidGeneration, false);
assert.equal(primaryClip.expectedCreditOperation, "none");
assert.equal(primaryClip.providerCostCategory, "not_billable");
assert.equal(primaryClip.stockIntent, null);
assert.equal(primaryClip.videoIntent, null);

const primaryImage = planCreatorSceneProduction({
  id: 2,
  text: "A real person is introduced through an authentic archival portrait.",
  sceneRole: "exposition",
  contentNature: "person",
  authenticityValue: 0.9,
  motionImportance: 0.1,
  documentarySourceContext: context({
    sourceClipCandidateCount: 0,
    sourceImageCandidateCount: 1,
    primarySourceClipCandidateCount: 0,
    primarySourceImageCandidateCount: 1,
  }),
}, "standard");

assert.equal(primaryImage.selectedTreatment, "source_image");
assert.deepEqual(primaryImage.reasonCodes, ["AUTHENTIC_SOURCE_AVAILABLE", "PRIMARY_SOURCE_AVAILABLE"]);
assert.equal(primaryImage.expectedPaidGeneration, false);
assert.equal(primaryImage.expectedCreditOperation, "none");

const existingAssetWins = planCreatorSceneProduction({
  id: 3,
  text: "A real person appears.",
  contentNature: "person",
  assetPreserved: true,
  image: "https://assets.example.com/current.jpg",
  documentarySourceContext: context(),
}, "standard");
assert.equal(existingAssetWins.selectedTreatment, "reuse_existing");
assert.equal(existingAssetWins.overrideState, "existing_asset_preserved");

const explicitImageOverrideWins = planCreatorSceneProduction({
  id: 4,
  text: "A real person appears.",
  contentNature: "person",
  renderMode: "image",
  motionImportance: 0.1,
  documentarySourceContext: context(),
}, "standard");
assert.notEqual(explicitImageOverrideWins.selectedTreatment, "source_clip");
assert.equal(explicitImageOverrideWins.overrideState, "user_forced_image");

const legacyWithoutContext = planCreatorSceneProduction({
  id: 5,
  text: "A real person walks through a city street.",
  contentNature: "person",
  authenticityValue: 0.9,
  motionImportance: 0.5,
}, "standard");
assert.notEqual(legacyWithoutContext.selectedTreatment, "source_clip");
assert.notEqual(legacyWithoutContext.selectedTreatment, "source_image");
assert.equal(legacyWithoutContext.scores.source_clip, 0);
assert.equal(legacyWithoutContext.scores.source_image, 0);

console.log("Stage 0.10H-4C authentic source-first routing tests passed.");
