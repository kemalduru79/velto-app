import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createValidatedEditorialAnalysis,
} from "../lib/research/editorialAnalysisContract.ts";

const route = await readFile(
  new URL("../app/api/creator-editorial-analysis/route.ts", import.meta.url),
  "utf8",
);

assert.match(route, /Do not stop after identifying the first sufficient grounded authority/);
assert.match(route, /materially distinct, nonredundant authorities/);
assert.match(route, /selection lenses only, never as required slots or quotas/);
assert.match(route, /Legitimately narrow material may return one claim/);
assert.match(route, /Atomicity governs claim shape, not graph minimality/);
assert.match(route, /Do not inflate claim count by paraphrasing one proposition several ways/);
assert.match(route, /phenomenon or definition; mechanism or causal process; concrete empirical observation or case; limitation, qualification, or reliability boundary; social, relational, or cultural formation; downstream consequence or real-world implication/);

assert.match(route, /sourceId: \{ type: "string", enum:/);
assert.match(route, /spanId: \{ type: "string", enum:/);
assert.match(route, /required: \["evidenceId", "sourceId", "spanId", "contextNote"\]/);
assert.match(route, /CREATOR_EDITORIAL_INITIAL_SELECTION_DIAGNOSTICS/);
assert.match(route, /initialProviderParsedClaimCount/);
assert.match(route, /initialProviderParsedEvidenceCount/);
assert.match(route, /initialProviderParsedLinkCount/);
assert.match(route, /initialProviderDistinctSourceCount/);
assert.equal((route.match(/client\.responses\.create\(/g) || []).length, 3);

const sources = [
  {
    sourceId: "source-1",
    adapterId: "grounded_search",
    provider: "fixture",
    title: "Mechanism",
    url: "https://example.test/mechanism",
    publisher: "Fixture",
    author: null,
    publishedAt: null,
    summary: "Recall reconstructs an event from stored fragments.",
    mediaKind: "article",
    raw: null,
  },
  {
    sourceId: "source-2",
    adapterId: "grounded_search",
    provider: "fixture",
    title: "Social formation",
    url: "https://example.test/social",
    publisher: "Fixture",
    author: null,
    publishedAt: null,
    summary: "Repeated family retellings changed how participants later described the event.",
    mediaKind: "article",
    raw: null,
  },
];

const proposal = {
  claims: [
    { claimId: "claim-mechanism", claimType: "FACT", text: "Recall reconstructs events from stored fragments." },
    { claimId: "claim-social", claimType: "RESEARCH_FINDING", text: "Repeated social retelling can alter later descriptions." },
  ],
  evidence: [
    { evidenceId: "evidence-mechanism", sourceId: "source-1", excerpt: sources[0].summary, contextNote: null },
    { evidenceId: "evidence-social", sourceId: "source-2", excerpt: sources[1].summary, contextNote: null },
  ],
  links: [
    { claimId: "claim-mechanism", evidenceId: "evidence-mechanism", stance: "supports" },
    { claimId: "claim-social", evidenceId: "evidence-social", stance: "supports" },
  ],
};

const graph = createValidatedEditorialAnalysis({ sources, proposal });
assert.deepEqual(graph.claims, proposal.claims);
assert.deepEqual(graph.evidence.map(({ locator: _locator, ...item }) => item), proposal.evidence);
assert.deepEqual(graph.links, proposal.links);

console.log("Stage 0.16B role-useful canonical editorial breadth tests passed.");
