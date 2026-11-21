import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  adaptYoutubeResearchCandidate,
  adaptYoutubeResearchCandidates,
} from "../lib/research/youtubeSourceAdapter.ts";

const candidate = {
  id: "abc123",
  title: "A grounded research source",
  description: "Source description with useful context.",
  channel: "Example Publisher",
  publishedAt: "2026-08-20T10:00:00Z",
  views: 12500,
  likes: 840,
  durationSec: 615,
  thumbnail: "https://example.com/thumb.jpg",
  url: "https://www.youtube.com/watch?v=abc123",
};

const source = adaptYoutubeResearchCandidate(candidate, "en");
assert.ok(source);
assert.equal(source.sourceId, "youtube:abc123");
assert.equal(source.adapterId, "youtube");
assert.equal(source.mediaKind, "video");
assert.equal(source.externalId, "abc123");
assert.equal(source.publisher, "Example Publisher");
assert.equal(source.language, "en");
assert.equal(source.durationSec, 615);
assert.equal(source.metrics.views, 12500);
assert.equal(source.metrics.likes, 840);
assert.equal(source.sourceMetadata.platform, "youtube");

assert.equal(
  adaptYoutubeResearchCandidate({ ...candidate, id: "" }, "en"),
  null,
);
assert.equal(
  adaptYoutubeResearchCandidates([candidate, { ...candidate, id: "" }], "tr").length,
  1,
);

const contract = readFileSync(
  new URL("../lib/research/sourceContract.ts", import.meta.url),
  "utf8",
);
assert.match(contract, /"youtube"/);
assert.match(contract, /"web"/);
assert.match(contract, /"primary"/);
assert.match(contract, /"academic"/);
assert.match(contract, /"news"/);
assert.match(contract, /sourceMetadata/);

const legacyRoute = readFileSync(
  new URL("../app/api/youtube-research/route.ts", import.meta.url),
  "utf8",
);
assert.match(legacyRoute, /YOUTUBE_SEARCH_URL/);
assert.match(legacyRoute, /researchContext/);

console.log("Stage 0.10H-1A research source contract tests passed.");
