import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeCreatorResearchSearchRequest } from "../lib/research/searchRequest.ts";

const normalized = normalizeCreatorResearchSearchRequest({
  query: "  future   of work  ",
  category: "academic",
  maxResults: 99,
  includeDomains: ["ARXIV.ORG", 42, "arxiv.org", "pubmed.ncbi.nlm.nih.gov"],
  excludeDomains: ["example.com", null],
  startPublishedDate: "2024-01-01",
});
assert.equal(normalized.query, "future of work");
assert.equal(normalized.category, "academic");
assert.equal(normalized.maxResults, 10);
assert.deepEqual(normalized.includeDomains, ["arxiv.org", "pubmed.ncbi.nlm.nih.gov"]);
assert.deepEqual(normalized.excludeDomains, ["example.com"]);
assert.equal(normalized.startPublishedDate, "2024-01-01T00:00:00.000Z");

assert.equal(
  normalizeCreatorResearchSearchRequest({ query: "topic" }).category,
  "web",
);
assert.throws(
  () => normalizeCreatorResearchSearchRequest({ query: "topic", category: "social" }),
  /RESEARCH_CATEGORY_INVALID/,
);
assert.throws(
  () => normalizeCreatorResearchSearchRequest({ query: "   " }),
  /RESEARCH_QUERY_REQUIRED/,
);

const boundary = readFileSync(
  new URL("../lib/security/creatorApiBoundary.ts", import.meta.url),
  "utf8",
);
assert.match(boundary, /"creator-research"/);
assert.match(boundary, /rateLimit:\s*8/);
assert.match(boundary, /maxBodyBytes:\s*64 \* 1024/);

const route = readFileSync(
  new URL("../app/api/creator-research/route.ts", import.meta.url),
  "utf8",
);
assert.match(route, /enforceCreatorApiBoundary/);
assert.match(route, /"creator-research"/);
assert.match(route, /ExaResearchSearchProvider/);
assert.match(route, /persistEconomicOperationBestEffort/);
assert.match(route, /grounded_research_search/);
assert.match(route, /providerCostUsd/);
assert.match(route, /key !== "provider" && key !== "resultId"/);
assert.doesNotMatch(route, /EXA_API_KEY/);
assert.doesNotMatch(route, /provider:\s*"exa"[\s\S]*NextResponse\.json\(\{[\s\S]*provider:/);

console.log("Stage 0.10H-1E creator research API contract tests passed.");
