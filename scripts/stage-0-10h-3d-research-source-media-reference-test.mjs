import assert from "node:assert/strict";
import { createResearchSourceMediaReference } from "../lib/research/sourceMediaReference.ts";

const videoSource = {
  sourceId: "primary:elon-interview",
  adapterId: "primary",
  mediaKind: "video",
  externalId: "elon-interview",
  title: "Interview transcript and video",
  url: "https://example.com/interview",
  publisher: "Example Publisher",
  author: "Example Author",
  publishedAt: "2026-07-01T12:00:00Z",
  language: "en",
  summary: "A primary-source interview.",
  thumbnailUrl: "https://example.com/thumb.jpg",
  durationSec: 1800,
  metrics: {},
  sourceMetadata: {
    provider: "hidden-provider-detail",
    rawRequestId: "must-not-drive-rights",
    license: "unverified-text",
  },
};

const reference = createResearchSourceMediaReference(videoSource, {
  capturedAt: "2026-08-29T17:45:00Z",
});

assert.equal(reference.version, "0.10H-3D");
assert.equal(reference.researchSourceId, "primary:elon-interview");
assert.equal(reference.adapterId, "primary");
assert.equal(reference.title, videoSource.title);
assert.equal(reference.author, "Example Author");
assert.equal(reference.thumbnailUrl, videoSource.thumbnailUrl);
assert.equal(reference.sourceMedia.sourceMediaKind, "video");
assert.equal(reference.sourceMedia.sourceUrl, videoSource.url);
assert.equal(reference.sourceMedia.publisher, "Example Publisher");
assert.equal(reference.sourceMedia.rightsholder, "");
assert.equal(reference.sourceMedia.publishedAt, "2026-07-01T12:00:00.000Z");
assert.equal(reference.sourceMedia.capturedAt, "2026-08-29T17:45:00.000Z");
assert.equal(reference.sourceMedia.sourceDurationSec, 1800);
assert.equal(reference.sourceMedia.licenseId, "");
assert.equal(reference.sourceMedia.attributionRequired, null);
assert.equal(reference.sourceMedia.rightsState, "review_required");
assert.equal(reference.sourceMedia.timecodeStartSec, null);
assert.equal(reference.sourceMedia.timecodeEndSec, null);
assert.equal("provider" in reference.sourceMedia, false);
assert.equal("rawRequestId" in reference.sourceMedia, false);

const documentSource = {
  ...videoSource,
  sourceId: "academic:paper-1",
  adapterId: "academic",
  mediaKind: "paper",
  url: "https://example.com/paper",
  durationSec: null,
};
const documentReference = createResearchSourceMediaReference(documentSource, {
  capturedAt: "2026-08-29T17:45:00Z",
});
assert.equal(documentReference.sourceMedia.sourceMediaKind, "document");
assert.equal(documentReference.sourceMedia.sourceDurationSec, null);

console.log("Stage 0.10H-3D research source media reference tests passed.");
