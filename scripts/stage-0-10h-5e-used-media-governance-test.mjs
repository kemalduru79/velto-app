import assert from "node:assert/strict";
import fs from "node:fs";
import { withCreatorMediaOriginMetadata } from "../lib/creator/mediaOrigin.ts";
import { withCreatorSourceMediaMetadata } from "../lib/creator/sourceMedia.ts";
import { createCreatorUsedMediaGovernanceResult } from "../lib/creator/usedMediaGovernance.ts";

const syntheticAsset = {
  id: "asset-synthetic",
  lifecycleState: "active",
  metadata: withCreatorMediaOriginMetadata({ generated: true }, "synthetic"),
};
const syntheticReview = createCreatorUsedMediaGovernanceResult({
  productionPackage: null,
  media: [
    { referenceType: "scene_image", referenceKey: "1:image", asset: syntheticAsset },
    { referenceType: "scene_image", referenceKey: "2:image", asset: syntheticAsset },
  ],
});
assert.equal(syntheticReview.summary.referencedMediaCount, 2);
assert.equal(syntheticReview.summary.resolvedActiveMediaCount, 1, "One reused asset must be governed once.");
assert.equal(syntheticReview.summary.syntheticMediaCount, 1);
assert.equal(syntheticReview.governance.status, "review");
assert.equal(
  syntheticReview.governance.issues.filter((issue) => issue.code === "SYNTHETIC_DISCLOSURE_REQUIRED").length,
  1,
);

const syntheticCleared = createCreatorUsedMediaGovernanceResult({
  productionPackage: null,
  media: [{ referenceType: "scene_image", referenceKey: "1:image", asset: syntheticAsset }],
  syntheticDisclosurePresent: true,
});
assert.equal(syntheticCleared.governance.status, "ready");

const reviewedSourceMetadata = withCreatorMediaOriginMetadata(
  withCreatorSourceMediaMetadata({}, {
    sourceMediaKind: "video",
    sourceUrl: "https://example.com/source-video",
    publisher: "Example Publisher",
    rightsholder: "Example Rightsholder",
    attributionRequired: false,
    rightsState: "review_required",
  }),
  "source_media",
);
const sourceReview = createCreatorUsedMediaGovernanceResult({
  productionPackage: null,
  media: [{
    referenceType: "scene_video",
    referenceKey: "1:video",
    asset: { id: "asset-source", lifecycleState: "active", metadata: reviewedSourceMetadata },
  }],
});
assert.equal(sourceReview.summary.sourceRightsMediaCount, 1);
assert.equal(sourceReview.governance.status, "review");
assert.ok(sourceReview.governance.issues.some((issue) =>
  issue.code === "RIGHTS_REVIEW_REQUIRED" && issue.subjectId === "asset-source"));

const restrictedMetadata = withCreatorMediaOriginMetadata(
  withCreatorSourceMediaMetadata({}, {
    sourceMediaKind: "image",
    sourceUrl: "https://example.com/restricted",
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
    referenceType: "scene_image",
    referenceKey: "1:image",
    asset: { id: "asset-restricted", lifecycleState: "active", metadata: restrictedMetadata },
  }],
});
assert.equal(restricted.governance.status, "blocked");
assert.ok(restricted.governance.issues.some((issue) => issue.code === "SOURCE_RESTRICTED"));

const unknown = createCreatorUsedMediaGovernanceResult({
  productionPackage: null,
  media: [{
    referenceType: "scene_image",
    referenceKey: "unknown:image",
    asset: { id: "asset-unknown", lifecycleState: "active", metadata: {} },
  }],
});
assert.equal(unknown.summary.rightsReviewMediaCount, 1);
assert.ok(unknown.governance.issues.some((issue) =>
  issue.code === "RIGHTS_REVIEW_REQUIRED" && issue.subjectId === "asset-unknown"));

const unresolved = createCreatorUsedMediaGovernanceResult({
  productionPackage: null,
  media: [
    { referenceType: "scene_image", referenceKey: "missing:image", asset: null },
    {
      referenceType: "scene_video",
      referenceKey: "trashed:video",
      asset: { id: "asset-trashed", lifecycleState: "trashed", metadata: syntheticAsset.metadata },
    },
  ],
});
assert.equal(unresolved.summary.resolvedActiveMediaCount, 0);
assert.equal(unresolved.summary.rightsReviewMediaCount, 2);
assert.equal(unresolved.governance.status, "review");

const route = fs.readFileSync("app/api/creator-project-governance/[projectId]/route.ts", "utf8");
const serverResolver = fs.readFileSync("lib/creator/usedMediaGovernance.server.ts", "utf8");
assert.match(route, /resolveCreatorProjectUsedMediaGovernance/);
assert.match(route, /ownerUserId:\s*principal\.id/);
assert.match(route, /governance:\s*result\.governance/);
assert.match(route, /summary:\s*result\.summary/);
assert.doesNotMatch(route, /provider\s*:/i);
assert.doesNotMatch(route, /sourceMetadata\s*:/i);

assert.match(serverResolver, /inspectProjectMediaReferences\(input\.project\)/);
assert.match(serverResolver, /reference\.referenceType === "scene_image"/);
assert.match(serverResolver, /reference\.referenceType === "scene_video"/);
assert.match(serverResolver, /findByPublicUrl\(input\.ownerUserId, url\)/);
assert.doesNotMatch(serverResolver, /provider\s*:/i);
assert.doesNotMatch(serverResolver, /sourceMetadata\s*:/i);

console.log("Stage 0.10H-5E used media governance tests passed.");
