import assert from "node:assert/strict";
import {
  RESEARCH_CLAIM_TYPES,
  createResearchClaimEvidenceGraph,
  isResearchClaimType,
} from "../lib/research/claimEvidenceGraph.ts";

assert.deepEqual(RESEARCH_CLAIM_TYPES, [
  "FACT",
  "PRIMARY_SOURCE_CLAIM",
  "RESEARCH_FINDING",
  "EXPERT_OPINION",
  "THEORY",
  "FORECAST",
  "HYPOTHESIS",
  "METAPHYSICAL_CLAIM",
  "EDITORIAL_INFERENCE",
  "THOUGHT_EXPERIMENT",
]);
assert.equal(isResearchClaimType("FACT"), true);
assert.equal(isResearchClaimType("TRUTH"), false);

const source = {
  sourceId: "youtube:abc123",
  adapterId: "youtube",
  mediaKind: "video",
  externalId: "abc123",
  title: "Primary interview",
  url: "https://www.youtube.com/watch?v=abc123",
  publisher: "Example Publisher",
  author: null,
  publishedAt: "2026-08-20T10:00:00Z",
  language: "en",
  summary: null,
  thumbnailUrl: null,
  durationSec: 600,
  metrics: { views: 1000, likes: 50 },
  sourceMetadata: { platform: "youtube" },
};

const claim = {
  claimId: "claim:1",
  claimType: "PRIMARY_SOURCE_CLAIM",
  text: "The speaker says the change may happen within a decade.",
};
const evidence = {
  evidenceId: "evidence:1",
  sourceId: source.sourceId,
  excerpt: "within the next ten years",
  contextNote: "The speaker frames this as a forecast, not a verified fact.",
  locator: {
    section: null,
    page: null,
    timecodeStartSec: 132,
    timecodeEndSec: 141,
  },
};

const graph = createResearchClaimEvidenceGraph({
  sources: [source],
  claims: [claim],
  evidence: [evidence],
  links: [{ claimId: claim.claimId, evidenceId: evidence.evidenceId, stance: "supports" }],
});
assert.equal(graph.version, "0.10H-1B");
assert.equal(graph.links[0].stance, "supports");

assert.throws(
  () => createResearchClaimEvidenceGraph({
    sources: [source, source],
    claims: [claim],
    evidence: [evidence],
    links: [],
  }),
  /SOURCE_ID_DUPLICATE/,
);

assert.throws(
  () => createResearchClaimEvidenceGraph({
    sources: [source],
    claims: [claim],
    evidence: [{ ...evidence, sourceId: "youtube:missing" }],
    links: [],
  }),
  /EVIDENCE_SOURCE_MISSING/,
);

assert.throws(
  () => createResearchClaimEvidenceGraph({
    sources: [source],
    claims: [claim],
    evidence: [evidence],
    links: [{ claimId: "claim:missing", evidenceId: evidence.evidenceId, stance: "contradicts" }],
  }),
  /LINK_CLAIM_MISSING/,
);

console.log("Stage 0.10H-1B claim/evidence contract tests passed.");
