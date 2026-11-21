import assert from "node:assert/strict";
import {
  applyEditorialPrimaryCoverageRepair,
  createEditorialPrimaryCoverageRepairContext,
} from "../lib/research/editorialPrimaryCoverageRepair.ts";

const evidencePrimaryText =
  "The article reports Musk's prediction that work may become optional.";
const evidenceSupportedText =
  "The article discusses status and identity in a post-work society.";
const evidenceContextText =
  "The article also frames broader questions about purpose.";

const secondarySource = {
  sourceId: "web:secondary",
  adapterId: "web",
  mediaKind: "webpage",
  externalId: null,
  title: "Secondary source",
  url: "https://example.test/secondary",
  publisher: "Example",
  author: "Example Author",
  publishedAt: "2026-01-01",
  language: "en",
  summary: [
    evidencePrimaryText,
    evidenceSupportedText,
    evidenceContextText,
  ].join(" "),
  thumbnailUrl: null,
  durationSec: null,
  metrics: {},
  sourceMetadata: {},
};

const primaryClaim = {
  claimId: "claim-primary",
  claimType: "FACT",
  text: "Elon Musk said work may eventually become optional.",
  propositionKind: "attributed_statement",
  origin: {
    attributedEntity: "Elon Musk",
    referencedWork: null,
  },
};

const supportedEditorialClaim = {
  claimId: "claim-supported",
  claimType: "EDITORIAL_INFERENCE",
  text: "A post-work transition could change how people derive social status.",
  propositionKind: "editorial_inference",
  origin: {
    attributedEntity: null,
    referencedWork: null,
  },
};

const contextualOnlyClaim = {
  claimId: "claim-context-only",
  claimType: "EDITORIAL_INFERENCE",
  text: "The transition could also reshape how purpose is discussed.",
  propositionKind: "editorial_inference",
  origin: {
    attributedEntity: null,
    referencedWork: null,
  },
};

const evidencePrimary = {
  evidenceId: "evidence-primary",
  sourceId: secondarySource.sourceId,
  excerpt: evidencePrimaryText,
  contextNote: null,
  locator: {
    section: null,
    page: null,
    timecodeStartSec: null,
    timecodeEndSec: null,
  },
};

const evidenceSupported = {
  evidenceId: "evidence-supported",
  sourceId: secondarySource.sourceId,
  excerpt: evidenceSupportedText,
  contextNote: null,
  locator: {
    section: null,
    page: null,
    timecodeStartSec: null,
    timecodeEndSec: null,
  },
};

const evidenceContext = {
  evidenceId: "evidence-context",
  sourceId: secondarySource.sourceId,
  excerpt: evidenceContextText,
  contextNote: null,
  locator: {
    section: null,
    page: null,
    timecodeStartSec: null,
    timecodeEndSec: null,
  },
};

const mixedGraph = {
  version: "0.10H-1B",
  sources: [secondarySource],
  claims: [primaryClaim, supportedEditorialClaim, contextualOnlyClaim],
  evidence: [evidencePrimary, evidenceSupported, evidenceContext],
  links: [
    {
      claimId: primaryClaim.claimId,
      evidenceId: evidencePrimary.evidenceId,
      stance: "supports",
    },
    {
      claimId: supportedEditorialClaim.claimId,
      evidenceId: evidenceSupported.evidenceId,
      stance: "supports",
    },
    {
      claimId: contextualOnlyClaim.claimId,
      evidenceId: evidenceContext.evidenceId,
      stance: "contextualizes",
    },
  ],
};

const mixedContext = createEditorialPrimaryCoverageRepairContext({
  frozenGraph: mixedGraph,
  originalPrimaryRequiredClaimIds: [primaryClaim.claimId],
  candidateSources: [],
  creatorProfile: {},
});

assert.equal(mixedContext.initialReadiness.status, "blocked");
assert.ok(
  mixedContext.initialReadiness.reviewReasons.includes(
    "CLAIMS_REQUIRE_TRACEABLE_EVIDENCE",
  ),
);

const mixedResult = applyEditorialPrimaryCoverageRepair({
  context: mixedContext,
  selection: { repairs: [] },
});

assert.deepEqual(mixedResult.unresolvedClaimIds, [primaryClaim.claimId]);
assert.deepEqual(mixedResult.excludedPrimaryClaimIds, [primaryClaim.claimId]);
assert.deepEqual(
  mixedResult.graph.claims.map((claim) => claim.claimId),
  [supportedEditorialClaim.claimId],
  "when a traceably supported safe claim survives, contextual-only unsupported claims must not keep script authority blocked",
);
assert.notEqual(
  mixedResult.readiness.status,
  "blocked",
  "the derived graph may proceed only because at least one supported safe claim survives",
);
assert.equal(
  mixedResult.readiness.reviewReasons.includes(
    "CLAIMS_REQUIRE_TRACEABLE_EVIDENCE",
  ),
  false,
);
assert.equal(
  mixedResult.readiness.reviewReasons.includes(
    "PRIMARY_SOURCE_COVERAGE_REQUIRED",
  ),
  false,
);
assert.ok(
  mixedResult.readiness.reviewReasons.includes(
    "MATERIAL_COUNTER_EVIDENCE_REVIEW",
  ),
  "counter-evidence remains a review concern",
);

const noSupportedGraph = {
  version: "0.10H-1B",
  sources: [secondarySource],
  claims: [primaryClaim, contextualOnlyClaim],
  evidence: [evidencePrimary, evidenceContext],
  links: [
    {
      claimId: primaryClaim.claimId,
      evidenceId: evidencePrimary.evidenceId,
      stance: "supports",
    },
    {
      claimId: contextualOnlyClaim.claimId,
      evidenceId: evidenceContext.evidenceId,
      stance: "contextualizes",
    },
  ],
};

const noSupportedContext = createEditorialPrimaryCoverageRepairContext({
  frozenGraph: noSupportedGraph,
  originalPrimaryRequiredClaimIds: [primaryClaim.claimId],
  candidateSources: [],
  creatorProfile: {},
});

const noSupportedResult = applyEditorialPrimaryCoverageRepair({
  context: noSupportedContext,
  selection: { repairs: [] },
});

assert.deepEqual(
  noSupportedResult.graph.claims.map((claim) => claim.claimId),
  [contextualOnlyClaim.claimId],
  "when no supported safe claim survives, existing fail-closed graph behavior must be preserved",
);
assert.equal(
  noSupportedResult.readiness.status,
  "blocked",
  "safe degradation must not invent authority when no traceably supported claim survives",
);

console.log("stage-0-19e6c-traceable-safe-graph-test: PASS");
