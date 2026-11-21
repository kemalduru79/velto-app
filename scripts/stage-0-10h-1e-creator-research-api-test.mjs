import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
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

const routeSource = ts.createSourceFile(
  "app/api/creator-research/route.ts",
  route,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
const responsePayloads = [];
function collectResponsePayloads(node) {
  if (
    ts.isCallExpression(node)
    && ts.isPropertyAccessExpression(node.expression)
    && node.expression.expression.getText(routeSource) === "NextResponse"
    && node.expression.name.text === "json"
    && node.arguments[0]
  ) {
    responsePayloads.push(node.arguments[0].getText(routeSource));
  }
  ts.forEachChild(node, collectResponsePayloads);
}
collectResponsePayloads(routeSource);

assert.ok(responsePayloads.length > 0, "Expected Creator Research API JSON responses.");
for (const payload of responsePayloads) {
  assert.doesNotMatch(payload, /\bprovider\s*:/);
  assert.doesNotMatch(payload, /["']exa["']/i);
}

console.log("Stage 0.10H-1E creator research API contract tests passed.");
