import assert from "node:assert/strict";
import {
  CREATOR_SOURCE_MEDIA_METADATA_VERSION,
  normalizeCreatorSourceMediaMetadata,
  withCreatorSourceMediaMetadata,
} from "../lib/creator/sourceMedia.ts";

const normalized = normalizeCreatorSourceMediaMetadata({
  sourceMediaKind: "video",
  sourceUrl: "https://example.com/watch?id=42",
  publisher: " Example Publisher ",
  rightsholder: "Example Rights Holder",
  publishedAt: "2026-08-01T10:00:00+03:00",
  capturedAt: "2026-08-29T17:00:00Z",
  licenseId: "example-license",
  licenseUrl: "https://example.com/license",
  licenseSnapshotDate: "2026-08-29",
  attributionRequired: true,
  attributionText: "Source: Example Publisher",
  rightsReviewNote: "Needs editorial rights review before publish.",
  sourceDurationSec: 120,
  timecodeStartSec: 10.12345,
  timecodeEndSec: 24.98765,
});

assert.equal(normalized.metadataVersion, CREATOR_SOURCE_MEDIA_METADATA_VERSION);
assert.equal(normalized.sourceMediaKind, "video");
assert.equal(normalized.sourceUrl, "https://example.com/watch?id=42");
assert.equal(normalized.publisher, "Example Publisher");
assert.equal(normalized.publishedAt, "2026-08-01T07:00:00.000Z");
assert.equal(normalized.licenseSnapshotDate, "2026-08-29T00:00:00.000Z");
assert.equal(normalized.timecodeStartSec, 10.123);
assert.equal(normalized.timecodeEndSec, 24.988);
assert.equal(normalized.rightsState, "unknown", "License metadata must never silently promote rights clearance.");

const reviewed = normalizeCreatorSourceMediaMetadata({
  sourceMediaKind: "image",
  sourceUrl: "https://example.com/photo",
  rightsState: "review_required",
});
assert.equal(reviewed.rightsState, "review_required");
assert.equal(reviewed.timecodeStartSec, null);
assert.equal(reviewed.timecodeEndSec, null);

const cleared = normalizeCreatorSourceMediaMetadata({
  sourceMediaKind: "document",
  sourceUrl: "https://example.com/report.pdf",
  rightsState: "cleared",
  rightsReviewNote: "Explicitly reviewed by the creator.",
});
assert.equal(cleared.rightsState, "cleared");

assert.throws(
  () => normalizeCreatorSourceMediaMetadata({ sourceMediaKind: "video" }),
  /SOURCE_MEDIA_URL_REQUIRED/,
);
assert.throws(
  () => normalizeCreatorSourceMediaMetadata({ sourceUrl: "javascript:alert(1)" }),
  /SOURCE_MEDIA_URL_INVALID/,
);
assert.throws(
  () => normalizeCreatorSourceMediaMetadata({
    sourceUrl: "https://example.com/video",
    timecodeStartSec: 2,
  }),
  /SOURCE_MEDIA_TIMECODE_INCOMPLETE/,
);
assert.throws(
  () => normalizeCreatorSourceMediaMetadata({
    sourceUrl: "https://example.com/video",
    sourceDurationSec: 10,
    timecodeStartSec: 8,
    timecodeEndSec: 11,
  }),
  /SOURCE_MEDIA_TIMECODE_OUT_OF_RANGE/,
);

const assetMetadata = withCreatorSourceMediaMetadata(
  { projectId: "project-1", generated: false },
  {
    sourceMediaKind: "image",
    sourceUrl: "https://example.com/photo",
    publisher: "Example Publisher",
    rightsState: "review_required",
  },
);
assert.equal(assetMetadata.projectId, "project-1");
assert.equal(assetMetadata.generated, false);
assert.equal(assetMetadata.sourceMedia.rightsState, "review_required");
assert.equal(assetMetadata.sourceMedia.sourceUrl, "https://example.com/photo");

console.log("Stage 0.10H-3A source media rights contract tests passed.");
