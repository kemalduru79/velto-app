import assert from "node:assert/strict";
import {
  createValidatedEditorialAnalysis,
} from "../lib/research/editorialAnalysisContract.ts";
import {
  createValidatedEditorialAnalysisWithOneRepair,
} from "../lib/research/editorialGroundingRepair.ts";

const canonicalExcerpt = "Experts questioned the vision of a world without work.";
const sources = [{
  sourceId: "web:guardian-example",
  adapterId: "web",
  mediaKind: "article",
  externalId: "guardian-example",
  title: "Experts question AI vision",
  url: "https://example.com/guardian-example",
  publisher: "Example Publisher",
  author: null,
  publishedAt: "2023-11-03T00:00:00.000Z",
  language: "en",
  summary: `Context before. ${canonicalExcerpt} Context after.`,
  thumbnailUrl: null,
  durationSec: null,
  metrics: {},
  sourceMetadata: {},
}];

function proposal(excerpt, sourceId = sources[0].sourceId) {
  return {
    claims: [{
      claimId: "claim-1",
      claimType: "EXPERT_OPINION",
      text: "Experts questioned the prediction.",
    }],
    evidence: [{
      evidenceId: "evidence-1",
      sourceId,
      excerpt,
      contextNote: "Expert criticism",
    }],
    links: [{
      claimId: "claim-1",
      evidenceId: "evidence-1",
      stance: "supports",
    }],
  };
}

const paraphrased = proposal(
  "Experts were skeptical about a future where nobody needs to work.",
);
assert.throws(
  () => createValidatedEditorialAnalysis({ sources, proposal: paraphrased }),
  /EDITORIAL_EVIDENCE_EXCERPT_NOT_GROUNDED:web:guardian-example/,
);

let repairCalls = 0;
let researchCalls = 0;
let repairEconomicsRecords = 0;
const repairedGraph = await createValidatedEditorialAnalysisWithOneRepair({
  sources,
  proposal: paraphrased,
  repair: async (input) => {
    repairCalls += 1;
    repairEconomicsRecords += 1;
    assert.equal(input.failingSourceId, sources[0].sourceId);
    assert.equal(input.sources, sources);
    assert.equal(input.proposal, paraphrased);
    return proposal(canonicalExcerpt);
  },
});
assert.equal(repairCalls, 1);
assert.equal(repairEconomicsRecords, 1);
assert.equal(researchCalls, 0);
assert.equal(repairedGraph.evidence[0].excerpt, canonicalExcerpt);
assert.ok(sources[0].summary.includes(repairedGraph.evidence[0].excerpt));

repairCalls = 0;
repairEconomicsRecords = 0;
const exactGraph = await createValidatedEditorialAnalysisWithOneRepair({
  sources,
  proposal: proposal(canonicalExcerpt),
  repair: async () => {
    repairCalls += 1;
    return proposal(canonicalExcerpt);
  },
});
assert.equal(exactGraph.evidence[0].excerpt, canonicalExcerpt);
assert.equal(repairCalls, 0, "exact evidence must not trigger repair");
assert.equal(repairEconomicsRecords, 0, "exact evidence must not record repair economics");

repairCalls = 0;
await assert.rejects(
  createValidatedEditorialAnalysisWithOneRepair({
    sources,
    proposal: paraphrased,
    repair: async () => {
      repairCalls += 1;
      return proposal("A second ungrounded paraphrase.");
    },
  }),
  /EDITORIAL_GROUNDING_REPAIR_EXCERPT_NOT_EXACT/,
);
assert.equal(repairCalls, 1, "failed repair must not retry recursively");

repairCalls = 0;
await assert.rejects(
  createValidatedEditorialAnalysisWithOneRepair({
    sources,
    proposal: paraphrased,
    repair: async () => {
      repairCalls += 1;
      return proposal(canonicalExcerpt.toLowerCase());
    },
  }),
  /EDITORIAL_GROUNDING_REPAIR_EXCERPT_NOT_EXACT/,
);
assert.equal(repairCalls, 1, "normalized similarity is not exact repair grounding");

repairCalls = 0;
await assert.rejects(
  createValidatedEditorialAnalysisWithOneRepair({
    sources,
    proposal: paraphrased,
    repair: async () => {
      repairCalls += 1;
      throw new Error("REPAIR_PROVIDER_FAILED");
    },
  }),
  /REPAIR_PROVIDER_FAILED/,
);
assert.equal(repairCalls, 1, "provider failure must remain fail closed");

repairCalls = 0;
await assert.rejects(
  createValidatedEditorialAnalysisWithOneRepair({
    sources,
    proposal: proposal(canonicalExcerpt, "web:unknown"),
    repair: async () => {
      repairCalls += 1;
      return proposal(canonicalExcerpt);
    },
  }),
  /EDITORIAL_EVIDENCE_SOURCE_MISSING:evidence-1/,
);
assert.equal(repairCalls, 0, "unknown sources must not be repaired or accepted");

repairCalls = 0;
await assert.rejects(
  createValidatedEditorialAnalysisWithOneRepair({
    sources,
    proposal: {
      ...proposal(canonicalExcerpt),
      links: [{ claimId: "claim-missing", evidenceId: "evidence-1", stance: "supports" }],
    },
    repair: async () => {
      repairCalls += 1;
      return proposal(canonicalExcerpt);
    },
  }),
  /LINK_CLAIM_MISSING:claim-missing/,
);
assert.equal(repairCalls, 0, "non-grounding validation failures remain fail closed");

repairCalls = 0;
await assert.rejects(
  createValidatedEditorialAnalysisWithOneRepair({
    sources,
    proposal: paraphrased,
    repair: async () => {
      repairCalls += 1;
      return {
        ...proposal(canonicalExcerpt),
        claims: [{
          ...proposal(canonicalExcerpt).claims[0],
          text: "A silently changed claim.",
        }],
      };
    },
  }),
  /EDITORIAL_GROUNDING_REPAIR_RELATIONSHIP_CHANGED/,
);
assert.equal(repairCalls, 1, "changed claims must fail without retry");

repairCalls = 0;
await assert.rejects(
  createValidatedEditorialAnalysisWithOneRepair({
    sources,
    proposal: paraphrased,
    repair: async () => {
      repairCalls += 1;
      return {
        ...proposal(canonicalExcerpt),
        links: [{
          claimId: "claim-1",
          evidenceId: "evidence-1",
          stance: "contradicts",
        }],
      };
    },
  }),
  /EDITORIAL_GROUNDING_REPAIR_RELATIONSHIP_CHANGED/,
);
assert.equal(repairCalls, 1, "changed links must fail without retry");

repairCalls = 0;
await assert.rejects(
  createValidatedEditorialAnalysisWithOneRepair({
    sources,
    proposal: paraphrased,
    repair: async () => {
      repairCalls += 1;
      return {
        ...proposal(canonicalExcerpt),
        evidence: [{
          ...proposal(canonicalExcerpt).evidence[0],
          contextNote: "Changed context",
        }],
      };
    },
  }),
  /EDITORIAL_GROUNDING_REPAIR_EVIDENCE_CHANGED/,
);
assert.equal(repairCalls, 1, "changed evidence metadata must fail without retry");

const secondCanonicalExcerpt = "A second exact passage remains independently grounded.";
const twoInvalidEvidence = {
  ...paraphrased,
  evidence: [
    paraphrased.evidence[0],
    {
      evidenceId: "evidence-2",
      sourceId: sources[0].sourceId,
      excerpt: "Another altered passage.",
      contextNote: "Second passage",
    },
  ],
  links: [
    paraphrased.links[0],
    {
      claimId: "claim-1",
      evidenceId: "evidence-2",
      stance: "contextualizes",
    },
  ],
};
const multiSources = [{
  ...sources[0],
  summary: `${sources[0].summary} ${secondCanonicalExcerpt}`,
}];
repairCalls = 0;
const multiRepairGraph = await createValidatedEditorialAnalysisWithOneRepair({
  sources: multiSources,
  proposal: twoInvalidEvidence,
  repair: async () => {
    repairCalls += 1;
    return {
      ...twoInvalidEvidence,
      evidence: [
        { ...twoInvalidEvidence.evidence[0], excerpt: canonicalExcerpt },
        { ...twoInvalidEvidence.evidence[1], excerpt: secondCanonicalExcerpt },
      ],
    };
  },
});
assert.equal(repairCalls, 1, "multiple invalid excerpts use one repair operation");
assert.deepEqual(
  multiRepairGraph.evidence.map((item) => item.excerpt),
  [canonicalExcerpt, secondCanonicalExcerpt],
);

repairCalls = 0;
const initiallyUngroundedAndInvalid = {
  ...paraphrased,
  links: [{
    claimId: "claim-1",
    evidenceId: "evidence-1",
    stance: "invalid-stance",
  }],
};
await assert.rejects(
  createValidatedEditorialAnalysisWithOneRepair({
    sources,
    proposal: initiallyUngroundedAndInvalid,
    repair: async () => {
      repairCalls += 1;
      return {
        ...initiallyUngroundedAndInvalid,
        evidence: [{
          ...initiallyUngroundedAndInvalid.evidence[0],
          excerpt: canonicalExcerpt,
        }],
      };
    },
  }),
  /EDITORIAL_EVIDENCE_STANCE_INVALID:claim-1:evidence-1/,
);
assert.equal(repairCalls, 1, "invalid repaired graph fails without another repair");

repairCalls = 0;
await assert.rejects(
  createValidatedEditorialAnalysisWithOneRepair({
    sources,
    proposal: {
      ...proposal(canonicalExcerpt),
      claims: [{ ...proposal(canonicalExcerpt).claims[0], claimType: "INVALID" }],
    },
    repair: async () => {
      repairCalls += 1;
      return proposal(canonicalExcerpt);
    },
  }),
  /EDITORIAL_CLAIM_TYPE_INVALID:claim-1/,
);
assert.equal(repairCalls, 0, "invalid claim types must not trigger repair");
assert.equal(researchCalls, 0, "grounding repair must not launch research");

console.log("Stage 0.10H UI acceptance editorial grounding repair tests passed.");
