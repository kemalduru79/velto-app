import assert from "node:assert/strict";
import {
  compileCanonicalEditorialGraph,
} from "../lib/research/canonicalEditorialGraphCompiler.ts";
import {
  createResearchClaimEvidenceGraph,
} from "../lib/research/claimEvidenceGraph.ts";

function source(sourceId, summary) {
  return {
    sourceId,
    adapterId: "web",
    mediaKind: "article",
    externalId: sourceId,
    title: `Source ${sourceId}`,
    url: `https://example.test/${sourceId}`,
    publisher: "Example Publisher",
    author: null,
    publishedAt: "2026-01-01",
    language: "en",
    summary,
    thumbnailUrl: null,
    durationSec: null,
    metrics: {},
    sourceMetadata: {},
  };
}

const sources = [
  source(
    "source-a",
    "Researchers observed that repeated retrieval changed later recall. The interviewee described the experience directly.",
  ),
  source(
    "source-b",
    "The archival report records that witness wording changed across interviews.",
  ),
];

const spanCatalog = [
  {
    spanId: "span-a-observation",
    sourceId: "source-a",
    text: "Researchers observed that repeated retrieval changed later recall.",
  },
  {
    spanId: "span-a-interview",
    sourceId: "source-a",
    text: "The interviewee described the experience directly.",
  },
  {
    spanId: "span-b-archive",
    sourceId: "source-b",
    text: "The archival report records that witness wording changed across interviews.",
  },
];

const worldStateClaim = {
  text: "Repeated retrieval can change later recall.",
  claimType: "RESEARCH_FINDING",
  propositionKind: "world_state",
  origin: { attributedEntity: null, referencedWork: null },
};
const attributedClaim = {
  text: "The interviewee said the experience felt immediate.",
  claimType: "FACT",
  propositionKind: "attributed_statement",
  origin: {
    attributedEntity: "The interviewee",
    referencedWork: null,
  },
};
const sharedContext = "The canonical passage supplies direct support.";

const proposal = {
  items: [
    {
      claim: worldStateClaim,
      evidenceSelections: [
        {
          sourceId: "source-a",
          spanId: "span-a-observation",
          stance: "supports",
          contextNote: sharedContext,
        },
        {
          sourceId: "source-b",
          spanId: "span-b-archive",
          stance: "contextualizes",
          contextNote: "The archive supplies a second grounded perspective.",
        },
      ],
    },
    {
      claim: attributedClaim,
      evidenceSelections: [
        {
          sourceId: "source-a",
          spanId: "span-a-observation",
          stance: "contextualizes",
          contextNote: sharedContext,
        },
      ],
    },
  ],
};

// 1-3. Multi-claim compilation, multiple selections, and one canonical span
// supporting multiple claims without duplicating equivalent evidence.
const graph = compileCanonicalEditorialGraph({ proposal, sources, spanCatalog });
assert.equal(graph.version, "0.10H-1B");
assert.equal(graph.claims.length, 2);
assert.equal(graph.evidence.length, 2);
assert.equal(graph.links.length, 3);
assert.equal(
  graph.evidence.filter((item) =>
    item.excerpt === spanCatalog[0].text && item.sourceId === "source-a"
  ).length,
  1,
  "exact equivalent evidence must be represented once",
);
const sharedEvidence = graph.evidence.find((item) =>
  item.excerpt === spanCatalog[0].text
);
assert.ok(sharedEvidence);
assert.equal(
  graph.links.filter((link) => link.evidenceId === sharedEvidence.evidenceId).length,
  2,
  "the same server-owned evidence may link to multiple claims",
);
assert.deepEqual(
  graph.links
    .filter((link) => link.evidenceId === sharedEvidence.evidenceId)
    .map((link) => link.stance)
    .toSorted(),
  ["contextualizes", "supports"],
  "claim identity and stance remain relational and do not alter evidence identity",
);
assert.match(graph.claims[0].claimId, /^claim:v2:[a-f0-9]{64}$/u);
assert.match(graph.evidence[0].evidenceId, /^evidence:v2:[a-f0-9]{64}$/u);

// Structural graph compilation is deliberately separate from readiness. A
// valid claim may have no selected evidence regardless of epistemic claim type.
const structurallyValidUnreadyGraph = compileCanonicalEditorialGraph({
  proposal: {
    items: [
      {
        claim: {
          text: "A structurally valid fact can await readiness evaluation.",
          claimType: "FACT",
          propositionKind: "world_state",
          origin: { attributedEntity: null, referencedWork: null },
        },
        evidenceSelections: [],
      },
      {
        claim: {
          text: "The witness said the event happened later.",
          claimType: "PRIMARY_SOURCE_CLAIM",
          propositionKind: "attributed_statement",
          origin: { attributedEntity: "The witness", referencedWork: null },
        },
        evidenceSelections: [],
      },
      {
        claim: {
          text: "Imagine memory without a stable autobiographical anchor.",
          claimType: "THOUGHT_EXPERIMENT",
          propositionKind: "editorial_inference",
          origin: { attributedEntity: null, referencedWork: null },
        },
        evidenceSelections: [],
      },
    ],
  },
  sources,
  spanCatalog,
});
assert.equal(structurallyValidUnreadyGraph.claims.length, 3);
assert.equal(structurallyValidUnreadyGraph.evidence.length, 0);
assert.equal(structurallyValidUnreadyGraph.links.length, 0);

// 4. JSON-valid values that violate the semantic contract fail closed.
assert.throws(
  () => compileCanonicalEditorialGraph({
    proposal: { items: [{ claim: "not-an-object", evidenceSelections: [] }] },
    sources,
    spanCatalog,
  }),
  /EDITORIAL_PROPOSAL_V2_CLAIM_INVALID/,
);
assert.throws(
  () => compileCanonicalEditorialGraph({
    proposal: {
      items: [{
        claim: { ...worldStateClaim, claimType: "NOT_A_CLAIM_TYPE" },
        evidenceSelections: [],
      }],
    },
    sources,
    spanCatalog,
  }),
  /EDITORIAL_PROPOSAL_V2_CLAIM_TYPE_INVALID/,
);
assert.throws(
  () => compileCanonicalEditorialGraph({
    proposal: {
      items: [{
        claim: worldStateClaim,
        evidenceSelections: [{
          sourceId: "source-a",
          spanId: "span-a-observation",
          stance: "agrees",
        }],
      }],
    },
    sources,
    spanCatalog,
  }),
  /EDITORIAL_PROPOSAL_V2_STANCE_INVALID/,
);
assert.throws(
  () => compileCanonicalEditorialGraph({
    proposal: {
      items: [{
        claim: { ...worldStateClaim, text: "   " },
        evidenceSelections: [],
      }],
    },
    sources,
    spanCatalog,
  }),
  /EDITORIAL_PROPOSAL_V2_TEXT_REQUIRED:items\[0\]\.claim\.text/,
);
assert.throws(
  () => compileCanonicalEditorialGraph({
    proposal: {
      items: [{
        claim: worldStateClaim,
        evidenceSelections: [{ spanId: "span-a-observation", stance: "supports" }],
      }],
    },
    sources,
    spanCatalog,
  }),
  /EDITORIAL_PROPOSAL_V2_TEXT_INVALID:items\[0\]\.evidenceSelections\[0\]\.sourceId/,
);
assert.throws(
  () => compileCanonicalEditorialGraph({
    proposal: {
      items: [{
        claim: worldStateClaim,
        evidenceSelections: [{ sourceId: "source-a", stance: "supports" }],
      }],
    },
    sources,
    spanCatalog,
  }),
  /EDITORIAL_PROPOSAL_V2_TEXT_INVALID:items\[0\]\.evidenceSelections\[0\]\.spanId/,
);

// 5-7. Selection authority is the frozen source/span catalog.
assert.throws(
  () => compileCanonicalEditorialGraph({
    proposal: {
      items: [{
        claim: worldStateClaim,
        evidenceSelections: [{
          sourceId: "source-missing",
          spanId: "span-a-observation",
          stance: "supports",
        }],
      }],
    },
    sources,
    spanCatalog,
  }),
  /CANONICAL_EDITORIAL_SOURCE_NOT_FOUND:source-missing/,
);
assert.throws(
  () => compileCanonicalEditorialGraph({
    proposal: {
      items: [{
        claim: worldStateClaim,
        evidenceSelections: [{
          sourceId: "source-a",
          spanId: "span-missing",
          stance: "supports",
        }],
      }],
    },
    sources,
    spanCatalog,
  }),
  /CANONICAL_EDITORIAL_SPAN_NOT_FOUND:source-a:span-missing/,
);
// E6G: a known source/known span mismatch uses frozen span ownership.
const canonicalizedMismatchGraph = compileCanonicalEditorialGraph({
  proposal: {
    items: [{
      claim: worldStateClaim,
      evidenceSelections: [{
        sourceId: "source-b",
        spanId: "span-a-observation",
        stance: "supports",
      }],
    }],
  },
  sources,
  spanCatalog,
});
assert.equal(canonicalizedMismatchGraph.evidence.length, 1);
assert.equal(canonicalizedMismatchGraph.evidence[0].sourceId, "source-a");
assert.equal(canonicalizedMismatchGraph.evidence[0].excerpt, spanCatalog[0].text);
assert.deepEqual(canonicalizedMismatchGraph.links, [{
  claimId: canonicalizedMismatchGraph.claims[0].claimId,
  evidenceId: canonicalizedMismatchGraph.evidence[0].evidenceId,
  stance: "supports",
}]);
assert.deepEqual(
  canonicalizedMismatchGraph,
  compileCanonicalEditorialGraph({
    proposal: {
      items: [{
        claim: worldStateClaim,
        evidenceSelections: [{
          sourceId: "source-a",
          spanId: "span-a-observation",
          stance: "supports",
        }],
      }],
    },
    sources,
    spanCatalog,
  }),
  "the mismatched source must not affect canonical graph authority or identity",
);

// 8-9. Duplicate semantic claims are explicitly rejected; the same normalized
// text with materially different authority is a deterministic conflict.
assert.throws(
  () => compileCanonicalEditorialGraph({
    proposal: {
      items: [
        { claim: worldStateClaim, evidenceSelections: [] },
        { claim: worldStateClaim, evidenceSelections: [] },
      ],
    },
    sources,
    spanCatalog,
  }),
  /CANONICAL_EDITORIAL_CLAIM_DUPLICATE/,
);
assert.throws(
  () => compileCanonicalEditorialGraph({
    proposal: {
      items: [
        { claim: worldStateClaim, evidenceSelections: [] },
        {
          claim: { ...worldStateClaim, claimType: "THEORY" },
          evidenceSelections: [],
        },
      ],
    },
    sources,
    spanCatalog,
  }),
  /CANONICAL_EDITORIAL_CLAIM_CONFLICT/,
);

// Exact repeated selections are safely deduplicated, while incompatible
// interpretations of the same span inside one claim fail closed.
const repeatedSelection = {
  sourceId: "source-a",
  spanId: "span-a-observation",
  stance: "supports",
  contextNote: sharedContext,
};
const selectionDedupGraph = compileCanonicalEditorialGraph({
  proposal: {
    items: [{
      claim: worldStateClaim,
      evidenceSelections: [repeatedSelection, repeatedSelection],
    }],
  },
  sources,
  spanCatalog,
});
assert.equal(selectionDedupGraph.evidence.length, 1);
assert.equal(selectionDedupGraph.links.length, 1);
assert.throws(
  () => compileCanonicalEditorialGraph({
    proposal: {
      items: [{
        claim: worldStateClaim,
        evidenceSelections: [
          repeatedSelection,
          { ...repeatedSelection, stance: "contradicts" },
        ],
      }],
    },
    sources,
    spanCatalog,
  }),
  /CANONICAL_EDITORIAL_EVIDENCE_SELECTION_CONFLICT/,
);
assert.throws(
  () => compileCanonicalEditorialGraph({
    proposal: {
      items: [{
        claim: worldStateClaim,
        evidenceSelections: [
          repeatedSelection,
          { ...repeatedSelection, contextNote: "A conflicting interpretation." },
        ],
      }],
    },
    sources,
    spanCatalog,
  }),
  /CANONICAL_EDITORIAL_EVIDENCE_SELECTION_CONFLICT/,
  "one claim cannot assign competing context semantics to the same span",
);

const distinctContextGraph = compileCanonicalEditorialGraph({
  proposal: {
    items: [
      {
        claim: worldStateClaim,
        evidenceSelections: [repeatedSelection],
      },
      {
        claim: attributedClaim,
        evidenceSelections: [{
          ...repeatedSelection,
          contextNote: "A distinct claim-relative interpretation.",
        }],
      },
    ],
  },
  sources,
  spanCatalog,
});
assert.equal(
  distinctContextGraph.evidence.length,
  2,
  "different context notes are explicit distinct evidence identities, not silently coalesced duplicates",
);
assert.notEqual(
  distinctContextGraph.evidence[0].evidenceId,
  distinctContextGraph.evidence[1].evidenceId,
);

// 10. Existing canonical proposition-authority rules remain authoritative.
assert.throws(
  () => compileCanonicalEditorialGraph({
    proposal: {
      items: [{
        claim: {
          text: "A named researcher made this statement.",
          claimType: "FACT",
          propositionKind: "attributed_statement",
          origin: { attributedEntity: null, referencedWork: null },
        },
        evidenceSelections: [],
      }],
    },
    sources,
    spanCatalog,
  }),
  /CLAIM_ATTRIBUTED_ENTITY_REQUIRED/,
);

// 11, 13, 14. Relational identity injection is rejected at every proposal
// level, making provider-authored dangling claim/evidence links unrepresentable.
assert.throws(
  () => compileCanonicalEditorialGraph({
    proposal: {
      items: [{
        claim: { ...worldStateClaim, claimId: "claim-provider" },
        evidenceSelections: [],
      }],
    },
    sources,
    spanCatalog,
  }),
  /EDITORIAL_PROPOSAL_V2_FIELD_UNSUPPORTED:items\[0\]\.claim\.claimId/,
);
assert.throws(
  () => compileCanonicalEditorialGraph({
    proposal: {
      items: [{
        claim: worldStateClaim,
        evidenceSelections: [{
          ...repeatedSelection,
          evidenceId: "evidence-provider",
        }],
      }],
    },
    sources,
    spanCatalog,
  }),
  /EDITORIAL_PROPOSAL_V2_FIELD_UNSUPPORTED:items\[0\]\.evidenceSelections\[0\]\.evidenceId/,
);
assert.throws(
  () => compileCanonicalEditorialGraph({
    proposal: { items: proposal.items, links: [{ claimId: "x", evidenceId: "y" }] },
    sources,
    spanCatalog,
  }),
  /EDITORIAL_PROPOSAL_V2_FIELD_UNSUPPORTED:proposal\.links/,
);

// 12. Repeated compilation and provider item reordering produce byte-equivalent
// canonical identities and relationships. Whitespace normalization is also
// identity-stable.
const repeatedGraph = compileCanonicalEditorialGraph({
  proposal,
  sources,
  spanCatalog,
});
assert.equal(JSON.stringify(repeatedGraph), JSON.stringify(graph));
const reorderedGraph = compileCanonicalEditorialGraph({
  proposal: { items: proposal.items.toReversed() },
  sources,
  spanCatalog,
});
assert.deepEqual(reorderedGraph, graph);
const whitespaceGraph = compileCanonicalEditorialGraph({
  proposal: {
    items: proposal.items.map((item) => ({
      claim: { ...item.claim, text: `  ${item.claim.text.replaceAll(" ", "   ")}  ` },
      evidenceSelections: item.evidenceSelections,
    })),
  },
  sources,
  spanCatalog,
});
assert.deepEqual(whitespaceGraph, graph);

// 15. Every generated relationship references compiler-created canonical
// objects, and the existing graph validator independently accepts the result.
const claimIds = new Set(graph.claims.map((claim) => claim.claimId));
const evidenceIds = new Set(graph.evidence.map((item) => item.evidenceId));
assert.equal(graph.links.every((link) => claimIds.has(link.claimId)), true);
assert.equal(graph.links.every((link) => evidenceIds.has(link.evidenceId)), true);
assert.deepEqual(
  createResearchClaimEvidenceGraph({
    sources: graph.sources,
    claims: graph.claims,
    evidence: graph.evidence,
    links: graph.links,
  }),
  graph,
);

// Bounded counts remain fail-closed without relying on a route or provider.
assert.throws(
  () => compileCanonicalEditorialGraph({
    proposal: {
      items: Array.from({ length: 31 }, (_, index) => ({
        claim: { ...worldStateClaim, text: `Bounded claim ${index}` },
        evidenceSelections: [],
      })),
    },
    sources,
    spanCatalog,
  }),
  /EDITORIAL_PROPOSAL_V2_ITEM_LIMIT_EXCEEDED/,
);
assert.throws(
  () => compileCanonicalEditorialGraph({
    proposal: {
      items: [{
        claim: worldStateClaim,
        evidenceSelections: Array.from({ length: 13 }, () => repeatedSelection),
      }],
    },
    sources,
    spanCatalog,
  }),
  /EDITORIAL_PROPOSAL_V2_ITEM_SELECTION_LIMIT_EXCEEDED/,
);

console.log("Stage 0.19A canonical editorial graph compiler tests passed.");
