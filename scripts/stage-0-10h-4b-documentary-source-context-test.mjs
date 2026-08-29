import assert from "node:assert/strict";
import { createCreatorDocumentarySourceContext } from "../lib/creator/documentarySourceContext.ts";

function reference({
  id,
  kind,
  rightsState = "review_required",
}) {
  return {
    version: "0.10H-3D",
    researchSourceId: id,
    adapterId: kind === "video" ? "youtube" : "web",
    title: `Source ${id}`,
    author: null,
    thumbnailUrl: null,
    sourceMedia: {
      metadataVersion: "0.10H-3A",
      sourceMediaKind: kind,
      sourceUrl: `https://example.com/${id}`,
      publisher: "Example",
      rightsholder: "",
      publishedAt: null,
      capturedAt: "2026-08-29T00:00:00.000Z",
      licenseId: "",
      licenseUrl: null,
      licenseSnapshotDate: null,
      attributionRequired: null,
      attributionText: "",
      rightsState,
      rightsReviewNote: "",
      sourceDurationSec: kind === "video" ? 120 : null,
      timecodeStartSec: null,
      timecodeEndSec: null,
    },
  };
}

const references = [
  reference({ id: "primary-video", kind: "video" }),
  reference({ id: "cleared-image", kind: "image", rightsState: "cleared" }),
  reference({ id: "restricted-video", kind: "video", rightsState: "restricted" }),
  reference({ id: "insufficient-image", kind: "image", rightsState: "cleared" }),
  reference({ id: "primary-video", kind: "video" }),
];

const assessments = [
  {
    sourceId: "primary-video",
    directness: "primary",
    provenanceStatus: "complete",
    reviewStatus: "usable",
    reviewReasons: [],
  },
  {
    sourceId: "cleared-image",
    directness: "secondary",
    provenanceStatus: "complete",
    reviewStatus: "usable",
    reviewReasons: [],
  },
  {
    sourceId: "restricted-video",
    directness: "primary",
    provenanceStatus: "complete",
    reviewStatus: "usable",
    reviewReasons: [],
  },
  {
    sourceId: "insufficient-image",
    directness: "secondary",
    provenanceStatus: "partial",
    reviewStatus: "insufficient",
    reviewReasons: ["SOURCE_PROVENANCE_REVIEW"],
  },
];

const context = createCreatorDocumentarySourceContext({ references, assessments });

assert.equal(context.version, "0.10H-4B");
assert.equal(context.sourceReferenceCount, 4, "duplicate source ids must be deduplicated");
assert.equal(context.routingCandidateCount, 2);
assert.equal(context.sourceClipCandidateCount, 1);
assert.equal(context.sourceImageCandidateCount, 1);
assert.equal(context.primarySourceClipCandidateCount, 1);
assert.equal(context.primarySourceImageCandidateCount, 0);
assert.equal(context.rightsReviewRequiredCount, 1);
assert.equal(context.excludedCount, 2);

const primaryVideo = context.candidates.find((candidate) => candidate.researchSourceId === "primary-video");
assert.equal(primaryVideo?.routingStatus, "review_required");
assert.equal(primaryVideo?.rightsState, "review_required");
assert.equal(primaryVideo?.directness, "primary");

const clearedImage = context.candidates.find((candidate) => candidate.researchSourceId === "cleared-image");
assert.equal(clearedImage?.routingStatus, "candidate");

const restrictedVideo = context.candidates.find((candidate) => candidate.researchSourceId === "restricted-video");
assert.equal(restrictedVideo?.routingStatus, "excluded");

const missingAssessmentContext = createCreatorDocumentarySourceContext({
  references: [reference({ id: "unassessed", kind: "video", rightsState: "cleared" })],
});
assert.equal(missingAssessmentContext.routingCandidateCount, 1);
assert.equal(missingAssessmentContext.rightsReviewRequiredCount, 1);
assert.equal(missingAssessmentContext.candidates[0].directness, "unknown");
assert.equal(missingAssessmentContext.candidates[0].reviewStatus, "review");
assert.equal(missingAssessmentContext.candidates[0].routingStatus, "review_required");

console.log("Stage 0.10H-4B documentary source context tests passed.");
