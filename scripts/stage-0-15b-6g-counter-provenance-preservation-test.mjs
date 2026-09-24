import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createValidatedEditorialAnalysis } from "../lib/research/editorialAnalysisContract.ts";
import { normalizeEditorialAnalysisRequest } from "../lib/research/editorialAnalysisRequest.ts";
import { createCanonicalEditorialDiscoveryBundle } from "../lib/research/editorialCanonicalSelectionRepair.ts";

const sources = Array.from({ length: 26 }, (_, index) => ({
  sourceId: `source-${index + 1}`,
  adapterId: "academic",
  mediaKind: "paper",
  title: `Source ${index + 1}`,
  url: `https://example.test/source-${index + 1}`,
  publisher: "Fixture",
  author: null,
  publishedAt: null,
  language: "en",
  summary: `Grounded material from source ${index + 1}.`,
  thumbnailUrl: null,
  durationSec: null,
  externalId: null,
  metrics: {},
  sourceMetadata: {},
}));

const normalized = normalizeEditorialAnalysisRequest({
  topic: "Memory and identity",
  sources: sources.slice(0, 3),
  sourceResearchPurposes: {
    "source-1": ["baseline"],
    "source-2": ["counter_evidence", "counter_evidence"],
    "source-3": ["supporting_evidence"],
    invented: ["counter_evidence"],
    "source-1-invalid": ["not_a_real_purpose"],
  },
});
assert.deepEqual(normalized.sourceResearchPurposes, {
  "source-1": ["baseline"],
  "source-2": ["counter_evidence"],
  "source-3": ["supporting_evidence"],
});

const baseGraph = createValidatedEditorialAnalysis({
  sources,
  proposal: {
    claims: [{ claimId: "claim-1", claimType: "FACT", text: "A grounded baseline claim." }],
    evidence: [{
      evidenceId: "evidence-1",
      sourceId: "source-1",
      excerpt: sources[0].summary,
      contextNote: null,
    }],
    links: [{ claimId: "claim-1", evidenceId: "evidence-1", stance: "supports" }],
  },
});

const spans = sources.map((source, index) => ({
  spanId: `span-${index + 1}`,
  sourceId: source.sourceId,
  text: source.summary,
  evidenceSpecificity: index % 2 === 0
    ? "concrete_observation"
    : "abstract_or_conceptual",
}));
const sourceResearchPurposes = Object.fromEntries(sources.map((source, index) => [
  source.sourceId,
  index === 25 ? ["counter_evidence"] : ["baseline"],
]));
const discovery = createCanonicalEditorialDiscoveryBundle({
  candidateSpans: spans,
  sourceResearchPurposes,
  missingCapabilities: ["uncertainty"],
  graph: baseGraph,
});
assert.equal(discovery.spans.length, 24);
assert.equal(
  discovery.spans.some((span) =>
    span.sourceId === "source-26"
  ),
  true,
  "counter-purpose provenance is retained before remaining discovery slots fill",
);

function graphWithStance(stance) {
  return createValidatedEditorialAnalysis({
    sources: sources.slice(0, 3),
    proposal: {
      claims: [{ claimId: "claim-1", claimType: "RESEARCH_FINDING", text: "A grounded claim." }],
      evidence: [{
        evidenceId: "evidence-1",
        sourceId: "source-2",
        excerpt: sources[1].summary,
        contextNote: stance === "contextualizes" ? "A supplied scope limitation." : null,
      }],
      links: [{ claimId: "claim-1", evidenceId: "evidence-1", stance }],
    },
  });
}
assert.equal(graphWithStance("supports").links[0].stance, "supports");
assert.equal(graphWithStance("contextualizes").links[0].stance, "contextualizes");
assert.equal(graphWithStance("contradicts").links[0].stance, "contradicts");

const noCounter = createCanonicalEditorialDiscoveryBundle({
  candidateSpans: spans,
  sourceResearchPurposes: Object.fromEntries(sources.map((source) => [source.sourceId, ["baseline"]])),
  missingCapabilities: ["uncertainty"],
  graph: baseGraph,
});
assert.equal(
  noCounter.spans.some((span) => Object.hasOwn(span, "researchPurposes")),
  false,
  "source-purpose provenance is not copied onto candidate spans",
);

const client = await readFile(
  new URL("../lib/research/creatorEditorialPipeline.client.ts", import.meta.url),
  "utf8",
);
const route = await readFile(
  new URL("../app/api/creator-editorial-analysis/route.ts", import.meta.url),
  "utf8",
);
assert.match(client, /sourceResearchPurposes/);
assert.match(client, /research\.lanes/);
assert.match(route, /candidateFromCounterPurposeSourceCount/);
assert.match(route, /Research purpose describes why a source was retrieved/);
assert.match(route, /does not classify any individual candidate span/);
assert.equal((route.match(/client\.responses\.create\(/g) || []).length, 3);

console.log("Stage 0.15B.6G counter/uncertainty provenance preservation: PASS");
