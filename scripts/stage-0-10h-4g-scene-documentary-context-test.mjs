import assert from "node:assert/strict";
import fs from "node:fs";
import { createCreatorSceneDocumentaryContext } from "../lib/creator/sceneDocumentaryContext.ts";

const sourceReferences = [
  {
    version: "0.10H-3D",
    researchSourceId: "s1",
    adapterId: "primary",
    title: "Primary video source",
    author: null,
    thumbnailUrl: null,
    sourceMedia: {
      version: "0.10H-3A",
      sourceMediaKind: "video",
      sourceUrl: "https://example.com/s1",
      publisher: "Publisher One",
      rightsholder: null,
      publishedAt: null,
      capturedAt: "2026-08-29T00:00:00.000Z",
      licenseId: null,
      licenseUrl: null,
      licenseSnapshotDate: null,
      attributionRequired: null,
      attributionText: null,
      rightsState: "cleared",
      rightsReviewNote: null,
      sourceDurationSec: 120,
      timecodeStartSec: null,
      timecodeEndSec: null,
    },
  },
  {
    version: "0.10H-3D",
    researchSourceId: "s2",
    adapterId: "academic",
    title: "Expert document source",
    author: null,
    thumbnailUrl: null,
    sourceMedia: {
      version: "0.10H-3A",
      sourceMediaKind: "document",
      sourceUrl: "https://example.com/s2",
      publisher: "Publisher Two",
      rightsholder: null,
      publishedAt: null,
      capturedAt: "2026-08-29T00:00:00.000Z",
      licenseId: null,
      licenseUrl: null,
      licenseSnapshotDate: null,
      attributionRequired: null,
      attributionText: null,
      rightsState: "review_required",
      rightsReviewNote: "Review before use.",
      sourceDurationSec: null,
      timecodeStartSec: null,
      timecodeEndSec: null,
    },
  },
  {
    version: "0.10H-3D",
    researchSourceId: "s3",
    adapterId: "news",
    title: "Untraceable global source",
    author: null,
    thumbnailUrl: null,
    sourceMedia: {
      version: "0.10H-3A",
      sourceMediaKind: "video",
      sourceUrl: "https://example.com/s3",
      publisher: "Publisher Three",
      rightsholder: null,
      publishedAt: null,
      capturedAt: "2026-08-29T00:00:00.000Z",
      licenseId: null,
      licenseUrl: null,
      licenseSnapshotDate: null,
      attributionRequired: null,
      attributionText: null,
      rightsState: "cleared",
      rightsReviewNote: null,
      sourceDurationSec: 60,
      timecodeStartSec: null,
      timecodeEndSec: null,
    },
  },
];

const sourceAssessments = [
  {
    sourceId: "s1",
    directness: "primary",
    provenanceStatus: "complete",
    reviewStatus: "usable",
    reviewReasons: [],
  },
  {
    sourceId: "s2",
    directness: "secondary",
    provenanceStatus: "complete",
    reviewStatus: "usable",
    reviewReasons: [],
  },
  {
    sourceId: "s3",
    directness: "primary",
    provenanceStatus: "complete",
    reviewStatus: "usable",
    reviewReasons: [],
  },
];

const bindings = {
  version: "0.10H-2C",
  statements: [
    {
      statementId: "st1",
      sceneId: 1,
      text: "A traceable factual statement.",
      evidenceMode: "required",
      claimReferences: [{ claimId: "c1", claimType: "FACT" }],
      supportingEvidenceIds: ["e1"],
      supportingSourceIds: ["s1"],
      counterEvidenceIds: [],
      counterSourceIds: [],
      contextualEvidenceIds: [],
      contextualSourceIds: [],
      traceabilityStatus: "traceable",
    },
    {
      statementId: "st2",
      sceneId: 1,
      text: "A partial statement must not leak its source into routing.",
      evidenceMode: "required",
      claimReferences: [{ claimId: "c3", claimType: "PRIMARY_SOURCE_CLAIM" }],
      supportingEvidenceIds: ["e3"],
      supportingSourceIds: ["s3"],
      counterEvidenceIds: [],
      counterSourceIds: [],
      contextualEvidenceIds: [],
      contextualSourceIds: [],
      traceabilityStatus: "partial",
    },
    {
      statementId: "st3",
      sceneId: 2,
      text: "A traceable expert statement.",
      evidenceMode: "required",
      claimReferences: [{ claimId: "c2", claimType: "EXPERT_OPINION" }],
      supportingEvidenceIds: ["e2"],
      supportingSourceIds: ["s2"],
      counterEvidenceIds: [],
      counterSourceIds: [],
      contextualEvidenceIds: [],
      contextualSourceIds: [],
      traceabilityStatus: "traceable",
    },
  ],
};

const graph = {
  version: "0.10H-1B",
  sources: [],
  claims: [],
  evidence: [
    {
      evidenceId: "e1",
      sourceId: "s1",
      excerpt: "Measured evidence for scene one.",
      contextNote: null,
      locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
    },
    {
      evidenceId: "e2",
      sourceId: "s2",
      excerpt: "Expert statement excerpt for scene two.",
      contextNote: null,
      locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
    },
    {
      evidenceId: "e3",
      sourceId: "s3",
      excerpt: "This partial evidence must not become scene routing context.",
      contextNote: null,
      locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
    },
  ],
  links: [],
};

const sceneOne = createCreatorSceneDocumentaryContext({
  sceneId: 1,
  bindings,
  graph,
  sourceReferences,
  sourceAssessments,
});
assert.equal(sceneOne.version, "0.10H-4G");
assert.equal(sceneOne.sceneId, "1");
assert.equal(sceneOne.documentarySourceContext.sourceReferenceCount, 1);
assert.equal(sceneOne.documentarySourceContext.routingCandidateCount, 1);
assert.equal(sceneOne.documentarySourceContext.sourceClipCandidateCount, 1);
assert.equal(sceneOne.documentarySourceContext.primarySourceClipCandidateCount, 1);
assert.deepEqual(
  sceneOne.documentarySourceContext.candidates.map((candidate) => candidate.researchSourceId),
  ["s1"],
);
assert.equal(sceneOne.evidenceVisualContext.dataVisualCandidate, true);
assert.equal(sceneOne.evidenceVisualContext.quoteCardCandidate, false);
assert.equal(sceneOne.evidenceVisualContext.sourceCardCandidate, true);

const sceneTwo = createCreatorSceneDocumentaryContext({
  sceneId: 2,
  bindings,
  graph,
  sourceReferences,
  sourceAssessments,
});
assert.equal(sceneTwo.documentarySourceContext.sourceReferenceCount, 1);
assert.deepEqual(
  sceneTwo.documentarySourceContext.candidates.map((candidate) => candidate.researchSourceId),
  ["s2"],
);
assert.equal(sceneTwo.documentarySourceContext.rightsReviewRequiredCount, 1);
assert.equal(sceneTwo.evidenceVisualContext.dataVisualCandidate, false);
assert.equal(sceneTwo.evidenceVisualContext.quoteCardCandidate, true);
assert.equal(sceneTwo.evidenceVisualContext.quoteCardRequiresReview, true);
assert.equal(sceneTwo.evidenceVisualContext.sourceCardCandidate, true);

const sceneThree = createCreatorSceneDocumentaryContext({
  sceneId: 3,
  bindings,
  graph,
  sourceReferences,
  sourceAssessments,
});
assert.equal(sceneThree.documentarySourceContext.sourceReferenceCount, 0);
assert.equal(sceneThree.documentarySourceContext.routingCandidateCount, 0);
assert.equal(sceneThree.evidenceVisualContext.traceableStatementCount, 0);
assert.equal(sceneThree.evidenceVisualContext.sourceCardCandidate, false);

const helper = fs.readFileSync("lib/creator/sceneDocumentaryContext.ts", "utf8");
assert.match(helper, /traceabilityStatus === "traceable"/);
assert.match(helper, /supportingSourceIds/);
assert.match(helper, /createCreatorDocumentarySourceContext/);
assert.match(helper, /createCreatorEvidenceVisualContext/);
assert.doesNotMatch(helper, /providerName|providerRequestId|providerCostUsd/);

console.log("Stage 0.10H-4G scene documentary context tests passed.");
