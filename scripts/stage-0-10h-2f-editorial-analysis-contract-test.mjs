import assert from "node:assert/strict";
import { createValidatedEditorialAnalysis } from "../lib/research/editorialAnalysisContract.ts";

const source = {
  sourceId: "web:1",
  adapterId: "web",
  mediaKind: "webpage",
  externalId: "1",
  title: "Research source",
  url: "https://example.com/research",
  publisher: "Example Publisher",
  author: null,
  publishedAt: "2026-01-01T00:00:00.000Z",
  language: "en",
  summary: "A 2026 study reports a measurable change in the observed outcome. The authors also note substantial uncertainty in long-range forecasts.",
  thumbnailUrl: null,
  durationSec: null,
  metrics: {},
  sourceMetadata: { provider: "hidden" },
};

const graph = createValidatedEditorialAnalysis({
  sources: [source],
  proposal: {
    claims: [
      { claimId: "c1", claimType: "RESEARCH_FINDING", text: "A study reports a measurable change in the observed outcome." },
      { claimId: "c2", claimType: "FORECAST", text: "Long-range outcomes remain uncertain." },
    ],
    evidence: [
      { evidenceId: "e1", sourceId: "web:1", excerpt: "A 2026 study reports a measurable change in the observed outcome.", contextNote: "Research finding." },
      { evidenceId: "e2", sourceId: "web:1", excerpt: "The authors also note substantial uncertainty in long-range forecasts.", contextNote: "Forecast limitation." },
    ],
    links: [
      { claimId: "c1", evidenceId: "e1", stance: "supports" },
      { claimId: "c2", evidenceId: "e2", stance: "contextualizes" },
    ],
  },
});
assert.equal(graph.version, "0.10H-1B");
assert.equal(graph.claims.length, 2);
assert.equal(graph.evidence.length, 2);
assert.equal(graph.links.length, 2);
assert.equal(graph.claims[0].claimType, "RESEARCH_FINDING");
assert.equal(graph.evidence[0].excerpt, "A 2026 study reports a measurable change in the observed outcome.");
assert.equal(graph.sources[0].sourceMetadata.provider, "hidden");

assert.throws(
  () => createValidatedEditorialAnalysis({
    sources: [source],
    proposal: {
      claims: [{ claimId: "c", claimType: "FACT", text: "A claim." }],
      evidence: [{ evidenceId: "e", sourceId: "web:1", excerpt: "This sentence does not exist in the supplied research material." }],
      links: [{ claimId: "c", evidenceId: "e", stance: "supports" }],
    },
  }),
  /EDITORIAL_EVIDENCE_EXCERPT_NOT_GROUNDED/,
);

assert.throws(
  () => createValidatedEditorialAnalysis({
    sources: [source],
    proposal: {
      claims: [{ claimId: "c", claimType: "CERTAIN_TRUTH", text: "A claim." }],
      evidence: [],
      links: [],
    },
  }),
  /EDITORIAL_CLAIM_TYPE_INVALID/,
);

assert.throws(
  () => createValidatedEditorialAnalysis({
    sources: [source],
    proposal: {
      claims: [{ claimId: "c", claimType: "FACT", text: "A claim." }],
      evidence: [{ evidenceId: "e", sourceId: "missing", excerpt: "" }],
      links: [{ claimId: "c", evidenceId: "e", stance: "supports" }],
    },
  }),
  /EDITORIAL_EVIDENCE_SOURCE_MISSING/,
);

assert.throws(
  () => createValidatedEditorialAnalysis({
    sources: [source],
    proposal: {
      claims: [{ claimId: "c", claimType: "FACT", text: "A claim." }],
      evidence: [{ evidenceId: "e", sourceId: "web:1", excerpt: "A 2026 study reports a measurable change" }],
      links: [{ claimId: "c", evidenceId: "e", stance: "proves" }],
    },
  }),
  /EDITORIAL_EVIDENCE_STANCE_INVALID/,
);

console.log("Stage 0.10H-2F editorial analysis contract tests passed.");
