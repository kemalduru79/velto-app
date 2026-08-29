import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const modulePath = path.join(root, "lib/creator/publishReadyPackage.ts");
const source = fs.readFileSync(modulePath, "utf8");
const compiled = ts.transpileModule(source, {
  fileName: modulePath,
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const module = { exports: {} };
new Function("module", "exports", compiled)(module, module.exports);
const { createCreatorPublishReadyPackageReport } = module.exports;

const readyInput = {
  productionPackage: { title: "Grounded documentary", scenes: [{ id: 1 }] },
  videoUrl: "https://cdn.example.com/final.mp4",
  thumbnail: { imageUrl: "data:image/png;base64,AAAA" },
  metadata: { recommendedTitle: "Title", description: "Description" },
  scenes: [{ id: 1, narration: "Grounded narration" }],
  targetPlatforms: ["youtube"],
  releaseChecklist: {
    systemChecks: [{ key: "finalVideo", ready: true }],
    userConfirmations: {
      videoReviewed: true,
      claimsVerified: true,
      rightsConfirmed: true,
      thumbnailApproved: true,
    },
  },
};

const governance = (status, issues = []) => ({
  version: "0.10H-5A",
  status,
  requiresManualReview: status !== "ready",
  blockedIssueCount: issues.filter((issue) => issue.severity === "blocked").length,
  reviewIssueCount: issues.filter((issue) => issue.severity === "review").length,
  issues,
});

const legacy = createCreatorPublishReadyPackageReport(readyInput);
assert.equal(legacy.canExport, true);
assert.equal(legacy.totalRequirements, 8, "Legacy 3R calls must keep the original requirement count.");
assert.doesNotMatch(JSON.stringify(legacy.requirements), /evidence_governance/);

const blocked = createCreatorPublishReadyPackageReport({
  ...readyInput,
  evidenceGovernance: governance("blocked", [{
    code: "MISSING_SOURCE",
    severity: "blocked",
    subjectId: "source-1",
    message: "A required source is missing.",
  }]),
});
assert.equal(blocked.canExport, false);
assert.equal(blocked.totalRequirements, 9);
assert.deepEqual(blocked.missingRequirementCodes, ["evidence_governance"]);

const rightsReview = createCreatorPublishReadyPackageReport({
  ...readyInput,
  evidenceGovernance: governance("review", [{
    code: "RIGHTS_REVIEW_REQUIRED",
    severity: "review",
    subjectId: "asset-1",
    message: "Rights require review.",
  }]),
});
assert.equal(rightsReview.canExport, true, "Existing rights confirmation may resolve a rights-review-only report.");

const rightsNotConfirmed = createCreatorPublishReadyPackageReport({
  ...readyInput,
  releaseChecklist: {
    ...readyInput.releaseChecklist,
    userConfirmations: {
      ...readyInput.releaseChecklist.userConfirmations,
      rightsConfirmed: false,
    },
  },
  evidenceGovernance: governance("review", [{
    code: "RIGHTS_REVIEW_REQUIRED",
    severity: "review",
    subjectId: "asset-1",
    message: "Rights require review.",
  }]),
});
assert.equal(rightsNotConfirmed.canExport, false);
assert.deepEqual(
  rightsNotConfirmed.missingRequirementCodes,
  ["creator_confirmations", "evidence_governance"],
);

for (const code of ["ATTRIBUTION_REQUIRED", "SYNTHETIC_DISCLOSURE_REQUIRED"]) {
  const unresolved = createCreatorPublishReadyPackageReport({
    ...readyInput,
    evidenceGovernance: governance("review", [{
      code,
      severity: "review",
      subjectId: "project",
      message: "Requires review.",
    }]),
  });
  assert.equal(unresolved.canExport, false, `${code} must not be bypassed by existing confirmations.`);
  assert.deepEqual(unresolved.missingRequirementCodes, ["evidence_governance"]);
}

assert.match(source, /input\.evidenceGovernance/);
assert.match(source, /issue\.code === "RIGHTS_REVIEW_REQUIRED"/);
assert.doesNotMatch(source, /SYNTHETIC_DISCLOSURE_REQUIRED"\s*&&\s*confirmations/);
assert.doesNotMatch(source, /ATTRIBUTION_REQUIRED"\s*&&\s*confirmations/);

console.log("Stage 0.10H-5G publish/release governance tests passed.");
