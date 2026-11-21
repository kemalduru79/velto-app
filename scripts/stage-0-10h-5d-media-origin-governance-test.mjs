import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CREATOR_MEDIA_ORIGIN_METADATA_VERSION,
  createCreatorMediaGovernanceProjection,
  inferCreatorMediaOrigin,
  withCreatorMediaOriginMetadata,
} from "../lib/creator/mediaOrigin.ts";
import { createStockAssetMetadata } from "../lib/providers/stock/sourceMetadata.ts";

const syntheticMetadata = withCreatorMediaOriginMetadata({ generated: true }, "synthetic");
assert.deepEqual(syntheticMetadata.creatorMediaOrigin, {
  version: CREATOR_MEDIA_ORIGIN_METADATA_VERSION,
  origin: "synthetic",
});
assert.equal(inferCreatorMediaOrigin(syntheticMetadata), "synthetic");

const synthetic = createCreatorMediaGovernanceProjection({
  assetId: "asset-generated",
  metadata: syntheticMetadata,
});
assert.equal(synthetic.origin, "synthetic");
assert.equal(synthetic.syntheticDisclosureRequired, true);
assert.equal(synthetic.sourceRightsMetadataRequired, false);
assert.equal(synthetic.sourceRightsMetadataStatus, "not_applicable");
assert.equal(synthetic.originReviewRequired, false);

// Legacy assets remain classifiable without a migration.
assert.equal(inferCreatorMediaOrigin({ generated: true }), "synthetic");
assert.equal(inferCreatorMediaOrigin({ source: "stock" }), "stock");
assert.equal(
  inferCreatorMediaOrigin({ sourceMedia: { sourceUrl: "https://example.com/source" } }),
  "source_media",
);
assert.equal(inferCreatorMediaOrigin({}), "unknown");

const sourceMedia = {
  sourceMediaKind: "video",
  sourceUrl: "https://example.com/source-video",
  publisher: "Example Publisher",
  rightsholder: "Example Rightsholder",
  rightsState: "review_required",
  attributionRequired: true,
  attributionText: "Example attribution",
};
const sourceProjection = createCreatorMediaGovernanceProjection({
  assetId: "asset-source",
  metadata: withCreatorMediaOriginMetadata({ sourceMedia }, "source_media"),
});
assert.equal(sourceProjection.origin, "source_media");
assert.equal(sourceProjection.sourceRightsMetadataRequired, true);
assert.equal(sourceProjection.sourceRightsMetadataStatus, "available");
assert.equal(sourceProjection.sourceMedia?.rightsState, "review_required");
assert.equal(sourceProjection.syntheticDisclosureRequired, false);

const missingRights = createCreatorMediaGovernanceProjection({
  assetId: "asset-stock-missing-rights",
  metadata: withCreatorMediaOriginMetadata({}, "stock"),
});
assert.equal(missingRights.sourceRightsMetadataStatus, "required_missing");

const unknown = createCreatorMediaGovernanceProjection({
  assetId: "asset-unknown",
  metadata: {},
});
assert.equal(unknown.origin, "unknown");
assert.equal(unknown.originReviewRequired, true);
assert.equal(unknown.syntheticDisclosureRequired, false);

const candidate = {
  sourceType: "stock",
  mediaType: "photo",
  provider: "pexels",
  providerMediaId: "p-1",
  sourcePageUrl: "https://www.pexels.com/photo/example-1/",
  creatorName: "Example Creator",
  creatorProfileUrl: "https://www.pexels.com/@example/",
  license: {
    id: "pexels-license",
    url: "https://www.pexels.com/license/",
    snapshotDate: "2026-08-22",
  },
  width: 1920,
  height: 1080,
  orientation: "landscape",
  durationSeconds: null,
  previewUrl: "https://images.pexels.com/photos/example.jpeg",
  renditions: [],
  averageColor: null,
  attributionText: "Photo by Example Creator on Pexels",
  metadataVersion: "2026-08-22",
};
const stockMetadata = createStockAssetMetadata({
  candidate,
  renditionId: "original",
  renditionWidth: 1920,
  renditionHeight: 1080,
  bytes: 1234,
  projectId: "project-1",
  reuseIdentity: "reuse-1",
  importedAt: "2026-08-29T19:15:00.000Z",
});
assert.equal(stockMetadata.creatorMediaOrigin.origin, "stock");
assert.equal(stockMetadata.creatorMediaOrigin.version, CREATOR_MEDIA_ORIGIN_METADATA_VERSION);
const stockProjection = createCreatorMediaGovernanceProjection({
  assetId: "asset-stock",
  metadata: stockMetadata,
});
assert.equal(stockProjection.origin, "stock");
assert.equal(stockProjection.sourceRightsMetadataStatus, "available");
assert.equal(stockProjection.sourceMedia?.rightsState, "review_required");

const imageRoute = fs.readFileSync("app/api/creator-store-image/route.ts", "utf8");
const videoRoute = fs.readFileSync("app/api/creator-store-video/route.ts", "utf8");
for (const source of [imageRoute, videoRoute]) {
  assert.match(source, /withCreatorMediaOriginMetadata/);
  assert.match(source, /generated:\s*true/);
  assert.match(source, /["']synthetic["']/);
}
assert.doesNotMatch(
  fs.readFileSync("lib/creator/mediaOrigin.ts", "utf8"),
  /legally safe|safe to use/i,
);

console.log("Stage 0.10H-5D media origin governance tests passed.");
