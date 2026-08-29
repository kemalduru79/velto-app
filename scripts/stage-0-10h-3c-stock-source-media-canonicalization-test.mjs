import assert from "node:assert/strict";
import fs from "node:fs";
import { createStockAssetMetadata } from "../lib/providers/stock/sourceMetadata.ts";

const candidate = {
  sourceType: "stock",
  mediaType: "video",
  provider: "pexels",
  providerMediaId: "12345",
  sourcePageUrl: "https://www.pexels.com/video/example-12345/",
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
  durationSeconds: 18.5,
  previewUrl: "https://videos.pexels.com/video-files/example.mp4",
  renditions: [],
  averageColor: null,
  attributionText: "Video by Example Creator on Pexels",
  metadataVersion: "2026-08-22",
};

const metadata = createStockAssetMetadata({
  candidate,
  renditionId: "production-1080p",
  renditionWidth: 1920,
  renditionHeight: 1080,
  bytes: 12_345_678,
  projectId: "project-1",
  reuseIdentity: "reuse-1",
  importedAt: "2026-08-29T17:30:00.000Z",
});

// Existing flat stock provenance remains backward compatible.
assert.equal(metadata.generated, false);
assert.equal(metadata.source, "stock");
assert.equal(metadata.provider, "Pexels");
assert.equal(metadata.providerMediaId, "12345");
assert.equal(metadata.sourcePageUrl, candidate.sourcePageUrl);
assert.equal(metadata.licenseId, "pexels-license");
assert.equal(metadata.attributionText, candidate.attributionText);
assert.equal(metadata.durationSeconds, 18.5);
assert.equal(metadata.projectId, "project-1");
assert.equal(metadata.metadataVersion, "2026-08-22");

// Canonical Source Media is added inside the same asset metadata envelope.
assert.equal(metadata.sourceMedia.sourceMediaKind, "video");
assert.equal(metadata.sourceMedia.sourceUrl, candidate.sourcePageUrl);
assert.equal(metadata.sourceMedia.publisher, "Pexels");
assert.equal(metadata.sourceMedia.rightsholder, "");
assert.equal(metadata.sourceMedia.capturedAt, "2026-08-29T17:30:00.000Z");
assert.equal(metadata.sourceMedia.licenseId, "pexels-license");
assert.equal(metadata.sourceMedia.attributionRequired, null);
assert.equal(metadata.sourceMedia.attributionText, candidate.attributionText);
assert.equal(metadata.sourceMedia.sourceDurationSec, 18.5);
assert.equal(metadata.sourceMedia.timecodeStartSec, null);
assert.equal(metadata.sourceMedia.timecodeEndSec, null);
assert.equal(
  metadata.sourceMedia.rightsState,
  "review_required",
  "A known stock license must not silently become legal clearance.",
);

const service = fs.readFileSync("lib/providers/stock/service.server.ts", "utf8");
assert.match(service, /import \{ createStockAssetMetadata \} from "\.\/sourceMetadata";/);
assert.match(service, /const metadata = createStockAssetMetadata\(\{/);
assert.doesNotMatch(service, /function sourceMetadata\(/);
assert.doesNotMatch(service, /rightsState:\s*["']cleared["']/);

console.log("Stage 0.10H-3C stock source media canonicalization tests passed.");
