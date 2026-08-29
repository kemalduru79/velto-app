import assert from "node:assert/strict";
import {
  createValidatedEditorialAnalysis,
} from "../lib/research/editorialAnalysisContract.ts";
import {
  createEditorialGroundingCandidateSpans,
  createValidatedEditorialAnalysisWithOneRepair,
  MAX_EDITORIAL_GROUNDING_SPANS_PER_REQUEST,
  MAX_EDITORIAL_GROUNDING_SPANS_PER_SOURCE,
} from "../lib/research/editorialGroundingRepair.ts";

const canonicalExcerpt = "Experts questioned the vision of a world without work.";
const secondCanonicalExcerpt = "İkinci kanıt cümlesi özgün metinde aynen yer alır.";
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
    language: "tr",
    summary: `Başlangıç. ${secondCanonicalExcerpt} Bitiş!`,
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

const spans = createEditorialGroundingCandidateSpans(sources);
const canonicalSpan = spans.find((span) => span.text.includes(canonicalExcerpt));
const secondSpan = spans.find((span) => span.text.includes(secondCanonicalExcerpt));
assert.ok(canonicalSpan);
assert.ok(secondSpan);
assert.deepEqual(spans, createEditorialGroundingCandidateSpans(sources));
assert.ok(spans.length <= MAX_EDITORIAL_GROUNDING_SPANS_PER_REQUEST);
for (const source of sources) {
  const sourceSpans = spans.filter((span) => span.sourceId === source.sourceId);
  assert.ok(sourceSpans.length <= MAX_EDITORIAL_GROUNDING_SPANS_PER_SOURCE);
  for (const span of sourceSpans) assert.ok(source.summary.includes(span.text));
}

function selection(
  span = canonicalSpan,
  evidenceId = "evidence-1",
) {
  return { repairs: [{ evidenceId, spanId: span.spanId }] };
}

const paraphrased = proposal("Experts were skeptical about a future without work.");
assert.throws(
  () => createValidatedEditorialAnalysis({ sources, proposal: paraphrased }),
  /EDITORIAL_EVIDENCE_EXCERPT_NOT_GROUNDED:web:guardian-example/,
);

let repairCalls = 0;
let economicsRecords = 0;
let researchCalls = 0;
const originalSnapshot = structuredClone(paraphrased);
const graph = await createValidatedEditorialAnalysisWithOneRepair({
  sources,
  proposal: paraphrased,
  repair: async (input) => {
    repairCalls += 1;
    economicsRecords += 1;
    assert.deepEqual(input.invalidEvidence.map((item) => item.evidenceId), ["evidence-1"]);
    assert.deepEqual(
      new Set(input.candidateSpans.map((span) => span.sourceId)),
      new Set([sources[0].sourceId]),
    );
    assert.equal("proposal" in input, false);
    assert.equal("sources" in input, false);
    return selection();
  },
});
assert.equal(repairCalls, 1);
assert.equal(economicsRecords, 1);
assert.deepEqual(paraphrased, originalSnapshot);
assert.deepEqual(graph.claims, originalSnapshot.claims);
assert.deepEqual(graph.links, originalSnapshot.links);
assert.equal(graph.evidence[0].contextNote, originalSnapshot.evidence[0].contextNote);
assert.equal(graph.evidence[0].sourceId, originalSnapshot.evidence[0].sourceId);
assert.equal(graph.evidence[0].excerpt, canonicalSpan.text);

repairCalls = 0;
economicsRecords = 0;
await createValidatedEditorialAnalysisWithOneRepair({
  sources,
  proposal: proposal(canonicalExcerpt),
  repair: async () => {
    repairCalls += 1;
    economicsRecords += 1;
    return selection();
  },
});
assert.equal(repairCalls, 0);
assert.equal(economicsRecords, 0);

const withUnrelated = {
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
    { claimId: "claim-1", evidenceId: "evidence-2", stance: "contextualizes" },
  ],
};
const unrelatedGraph = await createValidatedEditorialAnalysisWithOneRepair({
  sources,
  proposal: withUnrelated,
  repair: async (input) => {
    assert.deepEqual(
      new Set(input.candidateSpans.map((span) => span.sourceId)),
      new Set([sources[0].sourceId]),
    );
    return selection();
  },
});
assert.equal(unrelatedGraph.evidence[1].sourceId, sources[1].sourceId);
assert.equal(unrelatedGraph.evidence[1].excerpt, secondCanonicalExcerpt);
assert.equal(unrelatedGraph.evidence[1].contextNote, "Unrelated exact evidence");

const failures = [
  [
    { repairs: [{ ...selection().repairs[0], sourceId: sources[0].sourceId }] },
    /EDITORIAL_GROUNDING_REPAIR_SELECTION_INVALID/,
  ],
  [selection(canonicalSpan, "evidence-unknown"), /EDITORIAL_GROUNDING_REPAIR_EVIDENCE_MISSING/],
  [
    { repairs: [selection().repairs[0], selection().repairs[0]] },
    /EDITORIAL_GROUNDING_REPAIR_DUPLICATE_EVIDENCE/,
  ],
  [
    { repairs: [{ evidenceId: "evidence-1", spanId: "span-unknown" }] },
    /EDITORIAL_GROUNDING_REPAIR_SPAN_MISSING/,
  ],
  [
    { repairs: [{ evidenceId: "evidence-1", spanId: secondSpan.spanId }] },
    /EDITORIAL_GROUNDING_REPAIR_SPAN_MISSING/,
  ],
  [{ repairs: [], claims: [] }, /EDITORIAL_GROUNDING_REPAIR_SELECTION_INVALID/],
  [{ repairs: [] }, /EDITORIAL_GROUNDING_REPAIR_SELECTION_EMPTY/],
];
for (const [invalidSelection, expected] of failures) {
  await assert.rejects(
    createValidatedEditorialAnalysisWithOneRepair({
      sources,
      proposal: paraphrased,
      repair: async () => invalidSelection,
    }),
    expected,
  );
}

const twoInvalid = {
  ...withUnrelated,
  evidence: [
    paraphrased.evidence[0],
    { ...withUnrelated.evidence[1], excerpt: "İkinci değiştirilmiş ifade." },
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
        selection().repairs[0],
        selection(secondSpan, "evidence-2").repairs[0],
      ],
    };
  },
});
assert.equal(repairCalls, 1);
assert.deepEqual(
  multiGraph.evidence.map((item) => item.excerpt),
  [canonicalSpan.text, secondSpan.text],
);

const twoInvalidSameSource = {
  ...withUnrelated,
  evidence: [
    paraphrased.evidence[0],
    {
      ...withUnrelated.evidence[1],
      sourceId: sources[0].sourceId,
      excerpt: "Another altered excerpt.",
    },
  ],
};
repairCalls = 0;
await createValidatedEditorialAnalysisWithOneRepair({
  sources,
  proposal: twoInvalidSameSource,
  repair: async (input) => {
    repairCalls += 1;
    assert.deepEqual(
      new Set(input.candidateSpans.map((span) => span.sourceId)),
      new Set([sources[0].sourceId]),
    );
    return {
      repairs: [
        selection().repairs[0],
        selection(canonicalSpan, "evidence-2").repairs[0],
      ],
    };
  },
});
assert.equal(repairCalls, 1, "shared invalid sources use one span registry and call");

const overflowSources = Array.from({ length: 6 }, (_, sourceIndex) => ({
  ...sources[0],
  sourceId: `web:overflow-${sourceIndex + 1}`,
  externalId: `overflow-${sourceIndex + 1}`,
  url: `https://example.com/overflow-${sourceIndex + 1}`,
  summary: Array.from(
    { length: 12 },
    (_, sentenceIndex) => `Meaningful canonical sentence ${sourceIndex + 1}-${sentenceIndex + 1} contains sufficient context.`,
  ).join(" "),
}));
const overflowProposal = {
  claims: proposal(canonicalExcerpt).claims,
  evidence: overflowSources.map((source, index) => ({
    evidenceId: `overflow-evidence-${index + 1}`,
    sourceId: source.sourceId,
    excerpt: "Ungrounded altered excerpt.",
    contextNote: "Overflow test",
  })),
  links: overflowSources.map((_, index) => ({
    claimId: "claim-1",
    evidenceId: `overflow-evidence-${index + 1}`,
    stance: "supports",
  })),
};
repairCalls = 0;
await assert.rejects(
  createValidatedEditorialAnalysisWithOneRepair({
    sources: overflowSources,
    proposal: overflowProposal,
    repair: async () => {
      repairCalls += 1;
      return { repairs: [] };
    },
  }),
  /EDITORIAL_GROUNDING_REPAIR_CANDIDATE_LIMIT_EXCEEDED/,
);
assert.equal(repairCalls, 0, "candidate overflow fails before the model call");

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
      return selection();
    },
  }),
  /EDITORIAL_EVIDENCE_STANCE_INVALID/,
);
assert.equal(repairCalls, 1);

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
assert.equal(repairCalls, 1);

for (const invalidProposal of [
  proposal(canonicalExcerpt, "web:unknown"),
  {
    ...proposal(canonicalExcerpt),
    claims: [{ ...proposal(canonicalExcerpt).claims[0], claimType: "INVALID" }],
  },
]) {
  repairCalls = 0;
  await assert.rejects(
    createValidatedEditorialAnalysisWithOneRepair({
      sources,
      proposal: invalidProposal,
      repair: async () => {
        repairCalls += 1;
        return selection();
      },
    }),
  );
  assert.equal(repairCalls, 0);
}

assert.equal(researchCalls, 0);
console.log("Stage 0.10H UI acceptance editorial grounding repair tests passed.");
