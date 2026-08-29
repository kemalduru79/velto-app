import assert from "node:assert/strict";
import { createCreatorFinalProductionGate } from "../lib/creator/finalProductionGate.ts";

const readiness = {
  version: "3P",
  status: "ready",
  canStartFinalVideo: true,
  nextAction: "create_final_video",
  totalScenes: 2,
  readyVisualScenes: 2,
  readyVoiceScenes: 2,
  missingVisualSceneIds: [],
  missingVoiceSceneIds: [],
  blockingSceneIds: [],
};

const legacy = createCreatorFinalProductionGate({
  readiness,
  exportServiceStatus: "ready",
});
assert.equal(legacy.status, "ready");
assert.equal(legacy.canStartFinalVideo, true);
assert.equal(legacy.requiresManualConfirmation, false);
assert.equal(legacy.checks.evidenceGovernance, "ready");

const blocked = createCreatorFinalProductionGate({
  readiness,
  exportServiceStatus: "ready",
  evidenceGovernance: {
    version: "0.10H-5A",
    status: "blocked",
    requiresManualReview: true,
    blockedIssueCount: 1,
    reviewIssueCount: 0,
    issues: [{
      code: "UNSUPPORTED_CLAIM",
      severity: "blocked",
      subjectId: "statement-1",
      message: "A claim lacks sufficient traceable support.",
    }],
  },
});
assert.equal(blocked.status, "blocked");
assert.equal(blocked.canStartFinalVideo, false);
assert.equal(blocked.requiresManualConfirmation, false);
assert.equal(blocked.checks.evidenceGovernance, "blocked");

const review = createCreatorFinalProductionGate({
  readiness,
  exportServiceStatus: "ready",
  evidenceGovernance: {
    version: "0.10H-5A",
    status: "review",
    requiresManualReview: true,
    blockedIssueCount: 0,
    reviewIssueCount: 1,
    issues: [{
      code: "RIGHTS_REVIEW_REQUIRED",
      severity: "review",
      subjectId: "source-1",
      message: "This source-media rights state is unresolved and requires review before publication.",
    }],
  },
});
assert.equal(review.status, "review");
assert.equal(review.canStartFinalVideo, true);
assert.equal(review.requiresManualConfirmation, true);
assert.equal(review.checks.evidenceGovernance, "review");

const continuityAndEvidenceReview = createCreatorFinalProductionGate({
  readiness: { ...readiness, status: "confirmation_required" },
  exportServiceStatus: "ready",
  evidenceGovernance: {
    version: "0.10H-5A",
    status: "review",
    requiresManualReview: true,
    blockedIssueCount: 0,
    reviewIssueCount: 1,
    issues: [],
  },
});
assert.equal(continuityAndEvidenceReview.status, "review");
assert.equal(continuityAndEvidenceReview.requiresManualConfirmation, true);
assert.equal(continuityAndEvidenceReview.checks.continuity, "review");
assert.equal(continuityAndEvidenceReview.checks.evidenceGovernance, "review");

const exportUnavailable = createCreatorFinalProductionGate({
  readiness,
  exportServiceStatus: "unavailable",
  evidenceGovernance: {
    version: "0.10H-5A",
    status: "ready",
    requiresManualReview: false,
    blockedIssueCount: 0,
    reviewIssueCount: 0,
    issues: [],
  },
});
assert.equal(exportUnavailable.status, "blocked");
assert.equal(exportUnavailable.canStartFinalVideo, false);
assert.equal(exportUnavailable.checks.exportService, "blocked");

console.log("Stage 0.10H-5B final production governance gate tests passed.");
