import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildExaSearchRequest } from "../lib/providers/research/exaRequest.ts";
import { adaptExaSearchResponse } from "../lib/providers/research/exaAdapter.ts";

const academicRequest = buildExaSearchRequest({
  query: "  false memory hypnosis research  ",
  category: "academic",
  maxResults: 99,
  includeDomains: ["arxiv.org", "ARXIV.ORG", "pubmed.ncbi.nlm.nih.gov"],
  excludeDomains: ["arxiv.org", "example.com"],
  startPublishedDate: "2020-01-01",
});
assert.equal(academicRequest.query, "false memory hypnosis research");
assert.equal(academicRequest.category, "publication");
assert.equal(academicRequest.numResults, 10);
assert.deepEqual(academicRequest.includeDomains, ["arxiv.org", "pubmed.ncbi.nlm.nih.gov"]);
assert.deepEqual(academicRequest.excludeDomains, ["example.com"]);
assert.equal(academicRequest.contents.highlights, true);
assert.equal(academicRequest.startPublishedDate, "2020-01-01T00:00:00.000Z");

const newsRequest = buildExaSearchRequest({
  query: "future of work policy announcement",
  category: "news",
  maxResults: 4,
});
assert.equal(newsRequest.category, "news");
assert.equal(newsRequest.numResults, 4);

const primaryRequest = buildExaSearchRequest({
  query: "Elon Musk work optional interview",
  category: "primary",
  maxResults: 6,
  includeDomains: ["youtube.com", "x.com"],
});
assert.equal(primaryRequest.category, undefined);
assert.deepEqual(primaryRequest.includeDomains, ["youtube.com", "x.com"]);

assert.throws(
  () => buildExaSearchRequest({ query: "   ", category: "web" }),
  /RESEARCH_QUERY_REQUIRED/,
);

const academic = adaptExaSearchResponse({
  requestId: "req-1",
  costDollars: { total: 0.007 },
  results: [{
    id: "https://arxiv.org/abs/1234",
    title: "A Study of Memory",
    url: "https://arxiv.org/pdf/1234.pdf",
    publishedDate: "2025-01-02T00:00:00Z",
    author: "A. Researcher",
    highlights: ["The study found a measurable effect.", "Limitations remain."],
  }],
}, "academic");
assert.equal(academic.providerRequestId, "req-1");
assert.equal(academic.providerCostUsd, 0.007);
assert.equal(academic.sources.length, 1);
assert.equal(academic.sources[0].adapterId, "academic");
assert.equal(academic.sources[0].mediaKind, "paper");
assert.equal(academic.sources[0].publisher, "arxiv.org");
assert.equal(academic.sources[0].sourceMetadata.provider, "exa");
assert.equal(academic.sources[0].sourceMetadata.highlightCount, 2);
assert.match(academic.sources[0].summary || "", /measurable effect/);

const news = adaptExaSearchResponse({
  results: [{
    id: "news-1",
    title: "A current report",
    url: "https://news.example.com/story",
    summary: "A concise current report.",
  }],
}, "news");
assert.equal(news.sources[0].adapterId, "news");
assert.equal(news.sources[0].mediaKind, "article");

const primary = adaptExaSearchResponse({
  results: [{
    id: "primary-1",
    title: "Official statement",
    url: "https://example.gov/statement",
    text: "Official statement text.",
  }],
}, "primary");
assert.equal(primary.sources[0].adapterId, "primary");
assert.equal(primary.sources[0].mediaKind, "webpage");

const serverProvider = readFileSync(
  new URL("../lib/providers/research/exa.server.ts", import.meta.url),
  "utf8",
);
assert.match(serverProvider, /process\.env\.EXA_API_KEY/);
assert.match(serverProvider, /https:\/\/api\.exa\.ai\/search/);
assert.match(serverProvider, /"x-api-key"/);
assert.match(serverProvider, /cache: "no-store"/);
assert.match(serverProvider, /AbortSignal\.timeout/);
assert.doesNotMatch(serverProvider, /NEXT_PUBLIC_EXA/);

console.log("Stage 0.10H-1D grounded search provider tests passed.");
