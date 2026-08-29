import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeEditorialAnalysisRequest } from "../lib/research/editorialAnalysisRequest.ts";

const route = fs.readFileSync("app/api/creator-editorial-analysis/route.ts", "utf8");
const boundary = fs.readFileSync("lib/security/creatorApiBoundary.ts", "utf8");

const normalized = normalizeEditorialAnalysisRequest({
  topic: "  Evidence-aware topic  ",
  creatorProfile: { brandName: "Velto" },
  sources: [
    {
      sourceId: "source-1",
      adapterId: "news",
      mediaKind: "article",
      title: "Source title",
      url: "https://example.com/source",
      publisher: "Example",
      summary: "A grounded source summary used for editorial analysis.",
      metrics: { views: 999 },
      sourceMetadata: { provider: "hidden-provider", requestId: "hidden-request" },
    },
  ],
});

assert.equal(normalized.topic, "Evidence-aware topic");
assert.equal(normalized.sources.length, 1);
assert.deepEqual(normalized.sources[0].metrics, {});
assert.deepEqual(normalized.sources[0].sourceMetadata, {});
assert.equal(JSON.stringify(normalized).includes("hidden-provider"), false);
assert.equal(JSON.stringify(normalized).includes("hidden-request"), false);

assert.throws(
  () => normalizeEditorialAnalysisRequest({ topic: "x", sources: [] }),
  /EDITORIAL_SOURCES_REQUIRED/,
);
assert.throws(
  () => normalizeEditorialAnalysisRequest({
    topic: "x",
    sources: Array.from({ length: 41 }, (_, index) => ({
      sourceId: `source-${index}`,
      title: `Source ${index}`,
      url: `https://example.com/${index}`,
    })),
  }),
  /EDITORIAL_SOURCES_LIMIT_EXCEEDED/,
);
assert.throws(
  () => normalizeEditorialAnalysisRequest({
    topic: "x",
    sources: [
      { sourceId: "same", title: "A", url: "https://example.com/a" },
      { sourceId: "same", title: "B", url: "https://example.com/b" },
    ],
  }),
  /EDITORIAL_SOURCE_ID_DUPLICATE:same/,
);

assert.match(route, /enforceCreatorApiBoundary<Record<string, unknown>>\([\s\S]*"creator-editorial-analysis"/);
assert.match(route, /createValidatedEditorialAnalysis\(/);
assert.match(route, /recordOpenAITextEconomics\(/);
assert.match(route, /createEditorialScriptContext\(/);
assert.match(route, /EDITORIAL_ANALYSIS_GROUNDING_FAILED/);
for (const forbiddenMarker of [
  "providerRequestId",
  "rawProviderPayload",
  "providerRawResponse",
  "providerResponseBody",
]) {
  assert.equal(route.includes(forbiddenMarker), false, `provider metadata leaked: ${forbiddenMarker}`);
}

assert.match(boundary, /"creator-editorial-analysis":\s*\{[\s\S]*?maxBodyBytes:\s*256 \* 1024,[\s\S]*?rateLimit:\s*6,[\s\S]*?windowMs:\s*60_000/);

console.log("Stage 0.10H-2G editorial analysis API tests passed.");
