import assert from "node:assert/strict";
import {
  createEditorialGroundingCandidateSpans,
  createValidatedEditorialAnalysisWithOneRepair,
  installCanonicalEditorialEvidenceSpans,
} from "../lib/research/editorialGroundingRepair.ts";

function source(sourceId, summary) {
  return {
    sourceId, adapterId: "web", mediaKind: "article", externalId: sourceId,
    title: sourceId, url: "https://example.test/" + sourceId,
    publisher: "Example", author: null, publishedAt: "2026-01-01",
    language: "en", summary, thumbnailUrl: null,
    durationSec: null, metrics: {}, sourceMetadata: {},
  };
}
const sources = [
  source("source-a", "Source A covers one historical policy."),
  source("source-b", "Source B describes a different verified observation."),
];
const spans = createEditorialGroundingCandidateSpans(sources);
const spanA = spans.find((s) => s.sourceId === "source-a");
const spanB = spans.find((s) => s.sourceId === "source-b");
assert.ok(spanA && spanB);
const claim = {
  claimId: "claim-1", claimType: "FACT",
  text: "Source B describes a different verified observation.",
  propositionKind: "world_state",
  origin: { attributedEntity: null, referencedWork: null },
};
const proposal = {
  claims: [claim],
  evidence: [{ evidenceId: "evidence-5", sourceId: "source-b", spanId: spanA.spanId, contextNote: null }],
  links: [{ claimId: "claim-1", evidenceId: "evidence-5", stance: "supports" }],
};
assert.throws(
  () => installCanonicalEditorialEvidenceSpans({proposal, candidateSpans: spans}),
  /EDITORIAL_EVIDENCE_SPAN_SOURCE_MISMATCH:evidence-5/,
);

let calls = 0;
const result = await createValidatedEditorialAnalysisWithOneRepair({
  sources, proposal,
  requirePropositionAuthority: true,
  allowAmbiguousPropositionAuthority: true,
  provisionalPropositionAuthority: true,
  repair: async (input) => {
    calls++;
    assert.equal(input.diagnosticCategory, "EDITORIAL_EVIDENCE_SPAN_SOURCE_MISMATCH");
    assert.deepEqual(input.invalidEvidence.map((e) => e.evidenceId), ["evidence-5"]);
    assert.ok(input.candidateSpans.every((s) => s.sourceId === "source-b"));
    return { repairs: [{ evidenceId: "evidence-5", spanId: spanB.spanId }] };
  },
});
assert.equal(calls, 1, "Exactly one bounded repair");
assert.equal(result.evidence.length, 1);
assert.equal(result.evidence[0].sourceId, "source-b");
assert.equal(result.evidence[0].excerpt, spanB.text);
assert.equal(result.claims[0].text, claim.text);
assert.deepEqual(result.links.map((l) => l.stance), ["supports"]);

let rejectedCalls = 0;
await assert.rejects(
  () => createValidatedEditorialAnalysisWithOneRepair({
    sources, proposal,
    repair: async () => {
      rejectedCalls++;
      return { repairs: [{ evidenceId: "evidence-5", spanId: spanA.spanId }] };
    },
  }),
  /EDITORIAL_GROUNDING_REPAIR_SPAN_MISSING:evidence-5/,
);
assert.equal(rejectedCalls, 1, "Cross-source repair must fail closed");

let unknownSourceRepair = 0;
await assert.rejects(
  () => createValidatedEditorialAnalysisWithOneRepair({
    sources,
    proposal: {
      ...proposal,
      evidence: [{...proposal.evidence[0], sourceId: "not-available"}],
    },
    repair: async () => {
      unknownSourceRepair++;
      return { repairs: [{ evidenceId: "evidence-5", spanId: spanA.spanId }] };
    },
  }),
  /EDITORIAL_EVIDENCE_SOURCE_MISSING:evidence-5/,
);
assert.equal(unknownSourceRepair, 0, "Missing sources are never repaired by changing attribution");
console.log("CreatorLab cross-source editorial span repair PASS");
