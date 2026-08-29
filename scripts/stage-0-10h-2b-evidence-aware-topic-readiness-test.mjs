import assert from "node:assert/strict";
import { createResearchClaimEvidenceGraph } from "../lib/research/claimEvidenceGraph.ts";
import { createResearchTopicReadiness } from "../lib/research/topicEvidenceReadiness.ts";

const source = (sourceId, title) => ({
  sourceId,
  adapterId: "web",
  mediaKind: "webpage",
  externalId: sourceId,
  title,
  url: `https://example.com/${sourceId}`,
  publisher: "Example Publisher",
  author: null,
  publishedAt: "2026-01-01T00:00:00.000Z",
  language: "en",
  summary: null,
  thumbnailUrl: null,
  durationSec: null,
  metrics: {},
  sourceMetadata: {},
});

const locator = {
  section: null,
  page: null,
  timecodeStartSec: null,
  timecodeEndSec: null,
};

const graph = createResearchClaimEvidenceGraph({
  sources: [source("s-primary", "Primary record"), source("s-counter", "Counter analysis")],
  claims: [
    { claimId: "c-primary", claimType: "PRIMARY_SOURCE_CLAIM", text: "A source directly states a position." },
    { claimId: "c-forecast", claimType: "FORECAST", text: "A future outcome is forecast." },
  ],
  evidence: [
    { evidenceId: "e-primary", sourceId: "s-primary", excerpt: "Direct statement", contextNote: null, locator },
    { evidenceId: "e-forecast", sourceId: "s-primary", excerpt: "Forecast basis", contextNote: null, locator },
    { evidenceId: "e-counter", sourceId: "s-counter", excerpt: "Alternative scenario", contextNote: null, locator },
  ],
  links: [
    { claimId: "c-primary", evidenceId: "e-primary", stance: "supports" },
    { claimId: "c-forecast", evidenceId: "e-forecast", stance: "supports" },
    { claimId: "c-forecast", evidenceId: "e-counter", stance: "contradicts" },
  ],
});

const ready = createResearchTopicReadiness({
  graph,
  sourceAssessments: [
    { sourceId: "s-primary", directness: "primary", provenanceStatus: "complete", reviewStatus: "usable", reviewReasons: [] },
    { sourceId: "s-counter", directness: "secondary", provenanceStatus: "complete", reviewStatus: "usable", reviewReasons: [] },
  ],
});
assert.equal(ready.status, "ready");
assert.equal(ready.editorialReadinessScore, 100);
assert.equal(ready.dimensions.evidenceCoveragePct, 100);
assert.equal(ready.dimensions.primarySourceCoveragePct, 100);
assert.equal(ready.dimensions.counterEvidenceCoveragePct, 100);
assert.equal(ready.dimensions.sourceDiversityCount, 2);

const blocked = createResearchTopicReadiness({
  graph: createResearchClaimEvidenceGraph({
    sources: [source("s-secondary", "Secondary summary")],
    claims: [
      { claimId: "c-primary", claimType: "PRIMARY_SOURCE_CLAIM", text: "A direct-source claim." },
      { claimId: "c-fact", claimType: "FACT", text: "A factual statement." },
    ],
    evidence: [
      { evidenceId: "e-secondary", sourceId: "s-secondary", excerpt: "Indirect reference", contextNote: null, locator },
    ],
    links: [
      { claimId: "c-primary", evidenceId: "e-secondary", stance: "supports" },
    ],
  }),
  sourceAssessments: [
    { sourceId: "s-secondary", directness: "secondary", provenanceStatus: "complete", reviewStatus: "usable", reviewReasons: [] },
  ],
});
assert.equal(blocked.status, "blocked");
assert.deepEqual(blocked.unsupportedClaimIds, ["c-fact"]);
assert.deepEqual(blocked.primarySourceRequiredClaimIds, ["c-primary"]);
assert.deepEqual(blocked.primarySourceCoveredClaimIds, []);
assert.ok(blocked.reviewReasons.includes("CLAIMS_REQUIRE_TRACEABLE_EVIDENCE"));
assert.ok(blocked.reviewReasons.includes("PRIMARY_SOURCE_COVERAGE_REQUIRED"));

const metaphysicalReview = createResearchTopicReadiness({
  graph: createResearchClaimEvidenceGraph({
    sources: [source("s-claimant", "Claimant source")],
    claims: [
      { claimId: "c-meta", claimType: "METAPHYSICAL_CLAIM", text: "A metaphysical proposition is presented." },
    ],
    evidence: [
      { evidenceId: "e-meta", sourceId: "s-claimant", excerpt: "The proposition as stated", contextNote: "Evidence that the claim was made, not proof that it is true.", locator },
    ],
    links: [
      { claimId: "c-meta", evidenceId: "e-meta", stance: "supports" },
    ],
  }),
  sourceAssessments: [
    { sourceId: "s-claimant", directness: "primary", provenanceStatus: "complete", reviewStatus: "usable", reviewReasons: [] },
  ],
});
assert.equal(metaphysicalReview.status, "review");
assert.equal(metaphysicalReview.dimensions.evidenceCoveragePct, 100);
assert.equal(metaphysicalReview.dimensions.counterEvidenceCoveragePct, 0);
assert.ok(metaphysicalReview.reviewReasons.includes("MATERIAL_COUNTER_EVIDENCE_REVIEW"));

const thoughtExperiment = createResearchTopicReadiness({
  graph: createResearchClaimEvidenceGraph({
    sources: [],
    claims: [
      { claimId: "c-thought", claimType: "THOUGHT_EXPERIMENT", text: "Imagine a hypothetical future condition." },
    ],
    evidence: [],
    links: [],
  }),
  sourceAssessments: [],
});
assert.equal(thoughtExperiment.status, "ready");
assert.equal(thoughtExperiment.evidenceRequiredClaimCount, 0);
assert.equal(thoughtExperiment.editorialReadinessScore, 100);

console.log("Stage 0.10H-2B evidence-aware topic readiness tests passed.");
