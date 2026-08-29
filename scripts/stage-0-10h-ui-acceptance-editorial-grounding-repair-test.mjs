import assert from "node:assert/strict";
import {
  createValidatedEditorialAnalysis,
} from "../lib/research/editorialAnalysisContract.ts";
import {
  createValidatedEditorialAnalysisWithOneRepair,
} from "../lib/research/editorialGroundingRepair.ts";

const canonicalExcerpt = "Experts questioned the vision of a world without work.";
const secondCanonicalExcerpt = "A second exact passage remains independently grounded.";
const sources = [
  {
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
  },
  {
    sourceId: "web:second-example",
    adapterId: "web",
    mediaKind: "article",
    externalId: "second-example",
    title: "Second source",
    url: "https://example.com/second-example",
    publisher: "Example Publisher",
    author: null,
    publishedAt: "2023-11-04T00:00:00.000Z",
    language: "en",
    summary: `Opening. ${secondCanonicalExcerpt} Closing.`,
    thumbnailUrl: null,
    durationSec: null,
    metrics: {},
    sourceMetadata: {},
  },
];

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

function patch(excerpt = canonicalExcerpt, sourceId = sources[0].sourceId) {
  return {
    repairs: [{ evidenceId: "evidence-1", sourceId, excerpt }],
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
const originalSnapshot = structuredClone(paraphrased);
const repairedGraph = await createValidatedEditorialAnalysisWithOneRepair({
  sources,
  proposal: paraphrased,
  repair: async (input) => {
    repairCalls += 1;
    repairEconomicsRecords += 1;
    assert.equal(input.sources, sources);
    assert.equal(input.proposal, paraphrased);
    assert.equal(input.failingSourceId, sources[0].sourceId);
    return patch();
  },
});
assert.equal(repairCalls, 1);
assert.equal(repairEconomicsRecords, 1);
assert.equal(researchCalls, 0);
assert.deepEqual(paraphrased, originalSnapshot, "original proposal remains canonical and unmutated");
assert.deepEqual(repairedGraph.claims, originalSnapshot.claims);
assert.deepEqual(repairedGraph.links, originalSnapshot.links);
assert.equal(repairedGraph.evidence[0].contextNote, originalSnapshot.evidence[0].contextNote);
assert.equal(repairedGraph.evidence[0].excerpt, canonicalExcerpt);
assert.equal(
  repairedGraph.evidence[0].excerpt,
  sources[0].summary.slice(
    sources[0].summary.indexOf(canonicalExcerpt),
    sources[0].summary.indexOf(canonicalExcerpt) + canonicalExcerpt.length,
  ),
);

repairCalls = 0;
repairEconomicsRecords = 0;
const exactGraph = await createValidatedEditorialAnalysisWithOneRepair({
  sources,
  proposal: proposal(canonicalExcerpt),
  repair: async () => {
    repairCalls += 1;
    repairEconomicsRecords += 1;
    return patch();
  },
});
assert.equal(exactGraph.evidence[0].excerpt, canonicalExcerpt);
assert.equal(repairCalls, 0);
assert.equal(repairEconomicsRecords, 0);

const withUnrelatedEvidence = {
  ...paraphrased,
  evidence: [
    paraphrased.evidence[0],
    {
      evidenceId: "evidence-2",
      sourceId: sources[1].sourceId,
      excerpt: secondCanonicalExcerpt,
      contextNote: "Unrelated exact evidence",
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
const unrelatedGraph = await createValidatedEditorialAnalysisWithOneRepair({
  sources,
  proposal: withUnrelatedEvidence,
  repair: async () => patch(),
});
assert.deepEqual(unrelatedGraph.evidence[1], {
  evidenceId: "evidence-2",
  sourceId: sources[1].sourceId,
  excerpt: secondCanonicalExcerpt,
  contextNote: "Unrelated exact evidence",
  locator: {
    section: null,
    page: null,
    timecodeStartSec: null,
    timecodeEndSec: null,
  },
});

await assert.rejects(
  createValidatedEditorialAnalysisWithOneRepair({
    sources,
    proposal: paraphrased,
    repair: async () => proposal(canonicalExcerpt),
  }),
  /EDITORIAL_GROUNDING_REPAIR_PATCH_INVALID/,
  "a complete proposal is not an accepted repair contract",
);
await assert.rejects(
  createValidatedEditorialAnalysisWithOneRepair({
    sources,
    proposal: paraphrased,
    repair: async () => ({
      repairs: [{ evidenceId: "evidence-unknown", sourceId: sources[0].sourceId, excerpt: canonicalExcerpt }],
    }),
  }),
  /EDITORIAL_GROUNDING_REPAIR_EVIDENCE_MISSING:evidence-unknown/,
);
await assert.rejects(
  createValidatedEditorialAnalysisWithOneRepair({
    sources,
    proposal: paraphrased,
    repair: async () => ({ repairs: [patch().repairs[0], patch().repairs[0]] }),
  }),
  /EDITORIAL_GROUNDING_REPAIR_DUPLICATE_EVIDENCE:evidence-1/,
);
await assert.rejects(
  createValidatedEditorialAnalysisWithOneRepair({
    sources,
    proposal: paraphrased,
    repair: async () => patch(canonicalExcerpt, "web:unknown"),
  }),
  /EDITORIAL_GROUNDING_REPAIR_SOURCE_MISSING:evidence-1/,
);
await assert.rejects(
  createValidatedEditorialAnalysisWithOneRepair({
    sources,
    proposal: paraphrased,
    repair: async () => patch("A repaired paraphrase."),
  }),
  /EDITORIAL_GROUNDING_REPAIR_EXCERPT_NOT_EXACT:evidence-1/,
);
for (const invalidPatch of [
  {},
  { repairs: [] },
  { repairs: [{ evidenceId: "evidence-1", sourceId: sources[0].sourceId, excerpt: "" }] },
  { repairs: [{ evidenceId: "evidence-1", sourceId: "", excerpt: canonicalExcerpt }] },
]) {
  await assert.rejects(
    createValidatedEditorialAnalysisWithOneRepair({
      sources,
      proposal: paraphrased,
      repair: async () => invalidPatch,
    }),
    /EDITORIAL_GROUNDING_REPAIR_PATCH_(?:INVALID|EMPTY)/,
  );
}

const twoInvalid = {
  ...withUnrelatedEvidence,
  evidence: [
    paraphrased.evidence[0],
    { ...withUnrelatedEvidence.evidence[1], excerpt: "Second altered passage." },
  ],
};
repairCalls = 0;
const multiGraph = await createValidatedEditorialAnalysisWithOneRepair({
  sources,
  proposal: twoInvalid,
  repair: async () => {
    repairCalls += 1;
    return {
      repairs: [
        patch().repairs[0],
        { evidenceId: "evidence-2", sourceId: sources[1].sourceId, excerpt: secondCanonicalExcerpt },
      ],
    };
  },
});
assert.equal(repairCalls, 1);
assert.deepEqual(
  multiGraph.evidence.map((item) => item.excerpt),
  [canonicalExcerpt, secondCanonicalExcerpt],
);

const initiallyUngroundedAndInvalid = {
  ...paraphrased,
  links: [{ ...paraphrased.links[0], stance: "invalid-stance" }],
};
repairCalls = 0;
await assert.rejects(
  createValidatedEditorialAnalysisWithOneRepair({
    sources,
    proposal: initiallyUngroundedAndInvalid,
    repair: async () => {
      repairCalls += 1;
      return patch();
    },
  }),
  /EDITORIAL_EVIDENCE_STANCE_INVALID:claim-1:evidence-1/,
);
assert.equal(repairCalls, 1, "failed post-patch validation must not retry");

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
assert.equal(repairCalls, 1, "provider failure must not retry");

for (const invalidProposal of [
  proposal(canonicalExcerpt, "web:unknown"),
  {
    ...proposal(canonicalExcerpt),
    claims: [{ ...proposal(canonicalExcerpt).claims[0], claimType: "INVALID" }],
  },
  {
    ...proposal(canonicalExcerpt),
    links: [{ ...proposal(canonicalExcerpt).links[0], stance: "invalid-stance" }],
  },
]) {
  repairCalls = 0;
  await assert.rejects(
    createValidatedEditorialAnalysisWithOneRepair({
      sources,
      proposal: invalidProposal,
      repair: async () => {
        repairCalls += 1;
        return patch();
      },
    }),
  );
  assert.equal(repairCalls, 0, "unrelated initial failures must not trigger repair");
}

assert.equal(researchCalls, 0, "grounding repair has no research callback or request");
console.log("Stage 0.10H UI acceptance editorial grounding repair tests passed.");
