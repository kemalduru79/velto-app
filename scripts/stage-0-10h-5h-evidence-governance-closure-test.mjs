import assert from "node:assert/strict";
import fs from "node:fs";
import {
  withCreatorMediaOriginMetadata,
} from "../lib/creator/mediaOrigin.ts";
import {
  withCreatorSourceMediaMetadata,
} from "../lib/creator/sourceMedia.ts";
import {
  createCreatorUsedMediaGovernanceResult,
} from "../lib/creator/usedMediaGovernance.ts";
import {
  createCreatorFinalProductionGate,
} from "../lib/creator/finalProductionGate.ts";

const focusedGovernanceTests = [
  "scripts/stage-0-10h-5a-evidence-governance-contract-test.mjs",
  "scripts/stage-0-10h-5b-final-production-governance-gate-test.mjs",
  "scripts/stage-0-10h-5c-project-evidence-governance-test.mjs",
  "scripts/stage-0-10h-5d-media-origin-governance-test.mjs",
  "scripts/stage-0-10h-5e-used-media-governance-test.mjs",
  "scripts/stage-0-10h-5f-export-governance-enforcement-test.mjs",
  "scripts/stage-0-10h-5g-publish-release-governance-test.mjs",
];
const criticalRunner = fs.readFileSync("scripts/stage-0-8a-critical-regression.mjs", "utf8");
for (const testPath of focusedGovernanceTests) {
  assert.equal(fs.existsSync(testPath), true, `${testPath} must remain present.`);
  assert.match(criticalRunner, new RegExp(`"${testPath.replaceAll(".", "\\.")}"`));
}

const readiness = {
  version: "3P",
  status: "ready",
  canStartFinalVideo: true,
  nextAction: "create_final_video",
  totalScenes: 1,
  readyVisualScenes: 1,
  readyVoiceScenes: 1,
  missingVisualSceneIds: [],
  missingVoiceSceneIds: [],
  blockingSceneIds: [],
};

const ready = createCreatorUsedMediaGovernanceResult({
  productionPackage: null,
  media: [],
});
assert.equal(ready.governance.status, "ready");
assert.equal(ready.governance.requiresManualReview, false);

const synthetic = createCreatorUsedMediaGovernanceResult({
  productionPackage: null,
  media: [{
    referenceType: "scene_image",
    referenceKey: "scene-1:image",
    asset: {
      id: "asset-synthetic",
      lifecycleState: "active",
      metadata: withCreatorMediaOriginMetadata({}, "synthetic"),
    },
  }],
});
assert.equal(synthetic.governance.status, "review");
assert.ok(synthetic.governance.issues.some(
  (issue) => issue.code === "SYNTHETIC_DISCLOSURE_REQUIRED",
));
const syntheticFinalGate = createCreatorFinalProductionGate({
  readiness,
  exportServiceStatus: "ready",
  evidenceGovernance: synthetic.governance,
});
assert.equal(syntheticFinalGate.status, "review");
assert.equal(syntheticFinalGate.canStartFinalVideo, true);
assert.equal(syntheticFinalGate.requiresManualConfirmation, true);

const restrictedMetadata = withCreatorMediaOriginMetadata(
  withCreatorSourceMediaMetadata({}, {
    sourceMediaKind: "video",
    sourceUrl: "https://example.com/restricted-source-video",
    publisher: "Example Publisher",
    rightsholder: "Example Rightsholder",
    attributionRequired: false,
    rightsState: "restricted",
  }),
  "source_media",
);
const restricted = createCreatorUsedMediaGovernanceResult({
  productionPackage: null,
  media: [{
    referenceType: "scene_video",
    referenceKey: "scene-1:video",
    asset: {
      id: "asset-restricted",
      lifecycleState: "active",
      metadata: restrictedMetadata,
    },
  }],
});
assert.equal(restricted.governance.status, "blocked");
assert.ok(restricted.governance.issues.some(
  (issue) => issue.code === "SOURCE_RESTRICTED",
));
const restrictedFinalGate = createCreatorFinalProductionGate({
  readiness,
  exportServiceStatus: "ready",
  evidenceGovernance: restricted.governance,
});
assert.equal(restrictedFinalGate.status, "blocked");
assert.equal(restrictedFinalGate.canStartFinalVideo, false);
assert.equal(restrictedFinalGate.requiresManualConfirmation, false);

const evidenceGovernance = fs.readFileSync("lib/creator/evidenceGovernance.ts", "utf8");
for (const issueCode of [
  "UNSUPPORTED_CLAIM",
  "MISSING_SOURCE",
  "SOURCE_MISMATCH",
  "RIGHTS_REVIEW_REQUIRED",
  "ATTRIBUTION_REQUIRED",
  "SYNTHETIC_DISCLOSURE_REQUIRED",
]) {
  assert.match(evidenceGovernance, new RegExp(`"${issueCode}"`));
}
assert.doesNotMatch(
  evidenceGovernance,
  /legally safe|safe to use|legal clearance guaranteed/i,
);

const usedMediaServer = fs.readFileSync("lib/creator/usedMediaGovernance.server.ts", "utf8");
assert.match(usedMediaServer, /inspectProjectMediaReferences\(input\.project\)/);
assert.match(usedMediaServer, /reference\.referenceType === "scene_image"/);
assert.match(usedMediaServer, /reference\.referenceType === "scene_video"/);
assert.match(usedMediaServer, /findByPublicUrl\(input\.ownerUserId, url\)/);
assert.doesNotMatch(
  usedMediaServer,
  /provider(?:Name|Id|Metadata|Request|Response|Payload|Cost)\s*:/i,
);

const creatorExportRoute = fs.readFileSync("app/api/creator-export/route.ts", "utf8");
const projectLookup = creatorExportRoute.indexOf(
  "projectRepository.getForOwner(requestedProjectId, principal.id)",
);
const governanceResolve = creatorExportRoute.indexOf(
  "resolveCreatorProjectUsedMediaGovernance({",
);
const blockedCheck = creatorExportRoute.indexOf(
  'evidenceGovernance?.status === "blocked"',
);
const exportServiceWork = creatorExportRoute.indexOf(
  "const exportApiBase = getExportApiBase();",
);
const creditReservation = creatorExportRoute.indexOf(
  "creditReservation = await reserveMeteredOperation",
);
assert.ok(projectLookup >= 0);
assert.ok(governanceResolve > projectLookup);
assert.ok(blockedCheck > governanceResolve);
assert.ok(exportServiceWork > blockedCheck);
assert.ok(creditReservation > blockedCheck);

const packageRoute = fs.readFileSync("app/api/export-creator-package/route.ts", "utf8");
assert.match(packageRoute, /authenticateRequest\(req\)/);
assert.match(
  packageRoute,
  /projectRepository\.getForOwner\(\s*requestedProjectId,\s*principal\.id,\s*\)/,
);
assert.match(packageRoute, /project\.flow_type === "creator_lab"/);
assert.match(packageRoute, /resolveCreatorProjectUsedMediaGovernance\(\{/);
assert.match(
  packageRoute,
  /createCreatorPublishReadyPackageReport\(\{[\s\S]*?evidenceGovernance,/,
);
assert.doesNotMatch(
  packageRoute,
  /body\??\.(?:governance|evidenceGovernance|sourceMedia|sourceAssessments|claimGraph|claims|rightsMetadata|attribution|syntheticDisclosure)/,
);
const publishGate = packageRoute.indexOf("createCreatorPublishReadyPackageReport({");
assert.ok(publishGate >= 0);
assert.ok(publishGate < packageRoute.indexOf("fetchPackageAsset(", publishGate));
assert.ok(publishGate < packageRoute.lastIndexOf("createZip(entries)"));

const publishReadyPackage = fs.readFileSync("lib/creator/publishReadyPackage.ts", "utf8");
assert.match(
  publishReadyPackage,
  /issue\.code === "RIGHTS_REVIEW_REQUIRED"[\s\S]*?confirmations\.rightsConfirmed === true/,
);
assert.doesNotMatch(
  publishReadyPackage,
  /(?:SYNTHETIC_DISCLOSURE_REQUIRED|ATTRIBUTION_REQUIRED)["'][\s\S]{0,120}confirmations/,
);

const architectureSources = [
  evidenceGovernance,
  usedMediaServer,
  creatorExportRoute,
  packageRoute,
  publishReadyPackage,
].join("\n");
assert.doesNotMatch(
  architectureSources,
  /RightsPassport|Rights Passport|PreflightEngine|Preflight Engine/,
);

console.log("Stage 0.10H-5H Evidence Visuals & Governance closure tests passed.");
