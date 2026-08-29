import assert from "node:assert/strict";
import { parseCreatorProfile } from "../lib/creator/creatorProfile.ts";
import { createResearchClaimEvidenceGraph } from "../lib/research/claimEvidenceGraph.ts";
import { createEditorialScriptContext } from "../lib/research/editorialScriptContext.ts";

const locator = { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null };
const source = {
  sourceId: "s-primary",
  adapterId: "primary",
  mediaKind: "document",
  externalId: "doc-1",
  title: "Primary record",
  url: "https://example.com/primary",
  publisher: "Example Publisher",
  author: "Example Author",
  publishedAt: "2026-01-01T00:00:00.000Z",
  language: "en",
  summary: "Provider summary must not be required in the script context.",
  thumbnailUrl: null,
  durationSec: null,
  metrics: {},
  sourceMetadata: { provider: "hidden-provider", resultId: "hidden-request-detail" },
};
const graph = createResearchClaimEvidenceGraph({
  sources: [source],
  claims: [
    { claimId: "c1", claimType: "PRIMARY_SOURCE_CLAIM", text: "The primary record states a position." },
  ],
  evidence: [
    { evidenceId: "e1", sourceId: "s-primary", excerpt: "Direct statement", contextNote: "Use only in its original context.", locator },
  ],
  links: [
    { claimId: "c1", evidenceId: "e1", stance: "supports" },
  ],
});
const profile = parseCreatorProfile({
  brandName: "Velto Channel",
  editorialConstitution: {
    mission: "Investigate consequential ideas through evidence and human outcomes.",
    audiencePromise: "Separate what is known from what is speculative.",
    editorialPointOfView: "Curious, rigorous and non-sensational.",
  },
});
const context = createEditorialScriptContext({
  profile,
  graph,
  sourceAssessments: [
    { sourceId: "s-primary", directness: "primary", provenanceStatus: "complete", reviewStatus: "usable", reviewReasons: [] },
  ],
});
assert.equal(context.version, "0.10H-2E");
assert.equal(context.readiness.status, "ready");
assert.equal(context.readiness.editorialReadinessScore, 100);
assert.match(context.editorialConstitution, /Editorial mission:/);
assert.match(context.editorialConstitution, /do not overclaim/);
assert.deepEqual(context.claims[0].supportingEvidenceIds, ["e1"]);
assert.deepEqual(context.claims[0].counterEvidenceIds, []);
assert.equal(context.evidence[0].excerpt, "Direct statement");
assert.equal(context.sources[0].directness, "primary");
assert.equal(context.sources[0].reviewStatus, "usable");
assert.equal("sourceMetadata" in context.sources[0], false);
assert.equal("provider" in context.sources[0], false);
assert.equal(JSON.stringify(context).includes("hidden-provider"), false);
assert.equal(JSON.stringify(context).includes("hidden-request-detail"), false);

assert.throws(
  () => createEditorialScriptContext({
    profile,
    graph,
    sourceAssessments: [
      { sourceId: "orphan", directness: "secondary", provenanceStatus: "complete", reviewStatus: "usable", reviewReasons: [] },
    ],
  }),
  /EDITORIAL_SCRIPT_SOURCE_ASSESSMENT_ORPHAN/,
);

const noAssessment = createEditorialScriptContext({ profile, graph, sourceAssessments: [] });
assert.equal(noAssessment.sources[0].directness, "unknown");
assert.equal(noAssessment.sources[0].reviewStatus, "review");
assert.equal(noAssessment.readiness.status, "review");

console.log("Stage 0.10H-2E editorial script context tests passed.");
