import assert from "node:assert/strict";
import {
  createCreatorEvidenceGovernanceReport,
} from "../lib/creator/evidenceGovernance.ts";
import {
  normalizeCreatorSourceMediaMetadata,
} from "../lib/creator/sourceMedia.ts";

const sourceMedia = (overrides = {}) => normalizeCreatorSourceMediaMetadata({
  sourceMediaKind: "video",
  sourceUrl: "https://example.com/source",
  publisher: "Example Publisher",
  rightsState: "cleared",
  attributionRequired: false,
  ...overrides,
});

const ready = createCreatorEvidenceGovernanceReport({
  sourceMedia: [{ sourceId: "source-1", sourceMedia: sourceMedia() }],
  syntheticMediaUsed: false,
});
assert.equal(ready.status, "ready");
assert.equal(ready.requiresManualReview, false);
assert.equal(ready.issues.length, 0);

const unsupported = createCreatorEvidenceGovernanceReport({
  scriptQa: {
    version: "0.10H-2D",
    status: "blocked",
    statementCount: 1,
    blockedIssueCount: 1,
    reviewIssueCount: 0,
    issues: [{
      code: "STATEMENT_TRACEABILITY_REQUIRED",
      severity: "blocked",
      statementId: "statement-1",
      sceneId: 1,
      message: "Existing QA message",
    }],
  },
});
assert.equal(unsupported.status, "blocked");
assert.equal(unsupported.blockedIssueCount, 1);
assert.equal(unsupported.issues[0].code, "UNSUPPORTED_CLAIM");

const sourceIntegrity = createCreatorEvidenceGovernanceReport({
  missingSourceIds: ["source-missing", "source-missing"],
  mismatchedSourceIds: ["source-mismatch"],
});
assert.equal(sourceIntegrity.status, "blocked");
assert.deepEqual(
  sourceIntegrity.issues.map((issue) => issue.code).sort(),
  ["MISSING_SOURCE", "SOURCE_MISMATCH"].sort(),
);

const unresolvedRights = createCreatorEvidenceGovernanceReport({
  sourceMedia: [{
    sourceId: "source-review",
    sourceMedia: sourceMedia({
      rightsState: "review_required",
      licenseId: "license-present-does-not-clear-rights",
      licenseUrl: "https://example.com/license",
      attributionRequired: true,
      attributionText: "",
    }),
  }],
});
assert.equal(unresolvedRights.status, "review");
assert.equal(unresolvedRights.requiresManualReview, true);
assert.deepEqual(
  unresolvedRights.issues.map((issue) => issue.code).sort(),
  ["ATTRIBUTION_REQUIRED", "RIGHTS_REVIEW_REQUIRED"].sort(),
);
assert.ok(unresolvedRights.issues.every((issue) => /requires review/i.test(issue.message)));

const restricted = createCreatorEvidenceGovernanceReport({
  sourceMedia: [{
    sourceId: "source-restricted",
    sourceMedia: sourceMedia({ rightsState: "restricted" }),
  }],
});
assert.equal(restricted.status, "blocked");
assert.equal(restricted.issues[0].code, "SOURCE_RESTRICTED");

const syntheticDisclosure = createCreatorEvidenceGovernanceReport({
  syntheticMediaUsed: true,
  syntheticDisclosurePresent: false,
});
assert.equal(syntheticDisclosure.status, "review");
assert.equal(
  syntheticDisclosure.issues[0].code,
  "SYNTHETIC_DISCLOSURE_REQUIRED",
);

const disclosedSynthetic = createCreatorEvidenceGovernanceReport({
  syntheticMediaUsed: true,
  syntheticDisclosurePresent: true,
});
assert.equal(disclosedSynthetic.status, "ready");

for (const report of [ready, unsupported, sourceIntegrity, unresolvedRights, restricted, syntheticDisclosure]) {
  for (const issue of report.issues) {
    assert.doesNotMatch(issue.message, /legally safe|safe to use|legal clearance guaranteed/i);
  }
}

console.log("Stage 0.10H-5A evidence governance contract tests passed.");
