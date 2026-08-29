import assert from "node:assert/strict";
import { createCreatorProjectEvidenceGovernanceReport } from "../lib/creator/projectEvidenceGovernance.ts";
import { normalizeCreatorSourceMediaMetadata } from "../lib/creator/sourceMedia.ts";

function groundedPackage(overrides = {}) {
  return {
    scenes: [{ id: 1, narration: "Grounded statement.", dialogue: "" }],
    scriptPlan: {
      editorialContext: { used: true },
    },
    editorialEvidence: {
      binding: {
        version: "0.10H-2C",
        statements: [{
          statementId: "scene-1-speech",
          sceneId: 1,
          text: "Grounded statement.",
          evidenceMode: "required",
          supportingSourceIds: ["source-1"],
        }],
      },
      qa: {
        version: "0.10H-2D",
        status: "ready",
        statementCount: 1,
        blockedIssueCount: 0,
        reviewIssueCount: 0,
        issues: [],
      },
    },
    ...overrides,
  };
}

const ungrounded = createCreatorProjectEvidenceGovernanceReport({
  productionPackage: {
    scenes: [{ id: 1, narration: "Legacy creator scene." }],
    scriptPlan: { editorialContext: { used: false } },
  },
});
assert.equal(ungrounded.status, "ready");

const exact = createCreatorProjectEvidenceGovernanceReport({
  productionPackage: groundedPackage(),
  knownSourceIds: ["source-1"],
});
assert.equal(exact.status, "ready");
assert.equal(exact.issues.length, 0);

const missingSource = createCreatorProjectEvidenceGovernanceReport({
  productionPackage: groundedPackage(),
  knownSourceIds: ["another-source"],
});
assert.equal(missingSource.status, "blocked");
assert.equal(missingSource.issues.some((issue) =>
  issue.code === "MISSING_SOURCE" && issue.subjectId === "source-1"), true);

const changedScript = createCreatorProjectEvidenceGovernanceReport({
  productionPackage: groundedPackage({
    scenes: [{ id: 1, narration: "The user changed this statement after grounding.", dialogue: "" }],
  }),
  knownSourceIds: ["source-1"],
});
assert.equal(changedScript.status, "blocked");
assert.equal(changedScript.issues.some((issue) =>
  issue.code === "SOURCE_MISMATCH" && issue.subjectId === "source-1"), true);

const missingEvidencePackage = createCreatorProjectEvidenceGovernanceReport({
  productionPackage: {
    scenes: [{ id: 1, narration: "Grounded statement." }],
    scriptPlan: { editorialContext: { used: true } },
    editorialEvidence: null,
  },
});
assert.equal(missingEvidencePackage.status, "blocked");
assert.equal(missingEvidencePackage.issues.some((issue) =>
  issue.code === "MISSING_SOURCE" && issue.subjectId === "editorial-evidence-package"), true);

const unsupportedClaim = createCreatorProjectEvidenceGovernanceReport({
  productionPackage: groundedPackage({
    editorialEvidence: {
      binding: {
        version: "0.10H-2C",
        statements: [{
          statementId: "scene-1-speech",
          sceneId: 1,
          text: "Grounded statement.",
          evidenceMode: "required",
          supportingSourceIds: [],
        }],
      },
      qa: {
        version: "0.10H-2D",
        status: "blocked",
        statementCount: 1,
        blockedIssueCount: 1,
        reviewIssueCount: 0,
        issues: [{
          code: "STATEMENT_TRACEABILITY_REQUIRED",
          severity: "blocked",
          statementId: "scene-1-speech",
          sceneId: 1,
          message: "A statement that requires evidence has no supporting traceability.",
        }],
      },
    },
  }),
});
assert.equal(unsupportedClaim.status, "blocked");
assert.equal(unsupportedClaim.issues.some((issue) => issue.code === "UNSUPPORTED_CLAIM"), true);

const rightsReview = createCreatorProjectEvidenceGovernanceReport({
  productionPackage: groundedPackage(),
  knownSourceIds: ["source-1"],
  sourceMedia: [{
    sourceId: "asset-source-1",
    sourceMedia: normalizeCreatorSourceMediaMetadata({
      sourceMediaKind: "video",
      sourceUrl: "https://example.com/clip",
      rightsState: "review_required",
      attributionRequired: false,
    }),
  }],
});
assert.equal(rightsReview.status, "review");
assert.equal(rightsReview.issues.some((issue) => issue.code === "RIGHTS_REVIEW_REQUIRED"), true);

const syntheticReview = createCreatorProjectEvidenceGovernanceReport({
  productionPackage: groundedPackage(),
  knownSourceIds: ["source-1"],
  syntheticMediaUsed: true,
  syntheticDisclosurePresent: false,
});
assert.equal(syntheticReview.status, "review");
assert.equal(syntheticReview.issues.some((issue) =>
  issue.code === "SYNTHETIC_DISCLOSURE_REQUIRED"), true);

console.log("Stage 0.10H-5C project evidence governance tests passed.");
