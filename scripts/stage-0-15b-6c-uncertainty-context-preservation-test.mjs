import assert from "node:assert/strict";
import fs from "node:fs";
import { createValidatedEditorialAnalysis } from "../lib/research/editorialAnalysisContract.ts";
import {
  createEditorialGroundingCandidateSpans,
  createValidatedEditorialAnalysisWithOneRepair,
} from "../lib/research/editorialGroundingRepair.ts";

const supporting = "The measured result directly supports the documented finding.";
const limiting = "The authors state that the result applies only under the tested conditions and may not generalize beyond them.";
const opposing = "A separate comparison found no measurable effect under an alternative procedure.";
const source = {
  sourceId: "web:uncertainty",
  adapterId: "web",
  mediaKind: "article",
  externalId: "uncertainty",
  title: "Grounded findings and limits",
  url: "https://example.com/uncertainty",
  publisher: "Example",
  author: null,
  publishedAt: "2026-01-01T00:00:00.000Z",
  language: "en",
  summary: `${supporting} ${limiting} ${opposing}`,
  thumbnailUrl: null,
  durationSec: null,
  metrics: {},
  sourceMetadata: {},
};

const claim = { claimId: "claim-1", claimType: "FACT", text: "The measured result supports the finding." };
const canonical = createValidatedEditorialAnalysis({
  sources: [source],
  proposal: {
    claims: [claim],
    evidence: [
      { evidenceId: "support", sourceId: source.sourceId, excerpt: supporting, contextNote: null },
      { evidenceId: "limit", sourceId: source.sourceId, excerpt: limiting, contextNote: "Applies only under tested conditions." },
      { evidenceId: "opposing", sourceId: source.sourceId, excerpt: opposing, contextNote: null },
    ],
    links: [
      { claimId: claim.claimId, evidenceId: "support", stance: "supports" },
      { claimId: claim.claimId, evidenceId: "limit", stance: "contextualizes" },
      { claimId: claim.claimId, evidenceId: "opposing", stance: "contradicts" },
    ],
  },
});
assert.deepEqual(canonical.links.map((link) => link.stance), ["supports", "contextualizes", "contradicts"]);
assert.equal(canonical.claims[0].claimType, "FACT");

const supportOnly = createValidatedEditorialAnalysis({
  sources: [source],
  proposal: {
    claims: [claim],
    evidence: [{ evidenceId: "support", sourceId: source.sourceId, excerpt: supporting, contextNote: null }],
    links: [{ claimId: claim.claimId, evidenceId: "support", stance: "supports" }],
  },
});
assert.deepEqual(supportOnly.links.map((link) => link.stance), ["supports"]);
assert.equal(supportOnly.evidence.length, 1);

const spans = createEditorialGroundingCandidateSpans([source]);
const limitingSpan = spans.find((span) => span.text.includes("applies only under the tested conditions"));
const opposingSpan = spans.find((span) => span.text.includes("found no measurable effect"));
assert.ok(limitingSpan);
assert.ok(opposingSpan);

async function repairedStance(stance, repairedSpan) {
  const evidenceId = `evidence-${stance}`;
  const graph = await createValidatedEditorialAnalysisWithOneRepair({
    sources: [source],
    proposal: {
      claims: [claim],
      evidence: [{
        evidenceId,
        sourceId: source.sourceId,
        excerpt: "This invalid paraphrase is absent from the source.",
        contextNote: "Model-authored note remains non-authoritative.",
      }],
      links: [{ claimId: claim.claimId, evidenceId, stance }],
    },
    repair: async ({ invalidEvidence }) => {
      assert.equal(invalidEvidence[0].linkedClaims[0].stance, stance);
      return { repairs: [{ evidenceId, spanId: repairedSpan.spanId }] };
    },
  });
  assert.equal(graph.links[0].stance, stance);
  assert.equal(graph.evidence[0].excerpt, repairedSpan.text);
  return graph;
}

await repairedStance("contextualizes", limitingSpan);
await repairedStance("contradicts", opposingSpan);

const route = fs.readFileSync(new URL("../app/api/creator-editorial-analysis/route.ts", import.meta.url), "utf8");
assert.match(route, /Inspect the supplied candidate spans for material scope conditions/);
assert.match(route, /Use supports only when evidence directly supports a claim/);
assert.match(route, /Use contextualizes only when evidence materially narrows/);
assert.match(route, /Use contradicts only when evidence materially conflicts/);
assert.match(route, /When an exact supplied span materially limits, qualifies, contextualizes, or contradicts a FACT or RESEARCH_FINDING/);
assert.match(route, /return no invented contextual or contradictory authority/);
assert.doesNotMatch(route, /minItems:\s*[1-9][0-9]*[\s\S]{0,200}stance/);

console.log("Stage 0.15B.6C uncertainty/context preservation regression passed.");
