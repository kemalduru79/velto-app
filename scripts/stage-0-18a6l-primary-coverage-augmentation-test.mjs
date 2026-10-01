import assert from "node:assert/strict";
import fs from "node:fs";
import {
  applyEditorialPrimaryCoverageRepair,
  createEditorialPrimaryCoverageRepairContext,
} from "../lib/research/editorialPrimaryCoverageRepair.ts";

const secondarySource = {
  sourceId: "web:secondary",
  adapterId: "web",
  mediaKind: "webpage",
  externalId: null,
  title: "Secondary overview",
  url: "https://example.test/secondary",
  publisher: "Example",
  author: null,
  publishedAt: null,
  language: "en",
  summary: "A secondary overview describes the topic without direct authority.",
  thumbnailUrl: null,
  durationSec: null,
  metrics: {},
  sourceMetadata: {},
};

const baseClaims = [
  {
    claimId: "claim-research",
    claimType: "RESEARCH_FINDING",
    text: "The original study reported a measurable memory effect.",
    propositionKind: "original_research_result",
    origin: {
      attributedEntity: null,
      referencedWork: "Original Memory Study",
    },
  },
  {
    claimId: "claim-statement",
    claimType: "FACT",
    text: "Dr. Ada said memory confidence can exceed accuracy.",
    propositionKind: "attributed_statement",
    origin: {
      attributedEntity: "Dr. Ada",
      referencedWork: null,
    },
  },
  {
    claimId: "claim-world",
    claimType: "FACT",
    text: "Memory supports everyday decisions.",
    propositionKind: "world_state",
    origin: {
      attributedEntity: null,
      referencedWork: null,
    },
  },
];

const frozenGraph = {
  version: "0.10H-1B",
  sources: [secondarySource],
  claims: baseClaims,
  evidence: [],
  links: [],
};

const academicSource = {
  sourceId: "academic:memory-study",
  adapterId: "academic",
  mediaKind: "paper",
  externalId: "doi:10.1/memory",
  title: "Original Memory Study",
  url: "https://doi.org/10.1/memory",
  publisher: "Memory Journal",
  author: "Research Team",
  publishedAt: "2025-01-01",
  language: "en",
  summary: "Researchers assigned participants to two recall conditions. The participants shown misleading details later reported more altered memories than the control group.",
  thumbnailUrl: null,
  durationSec: null,
  metrics: {},
  sourceMetadata: {},
};

const transcriptSource = {
  sourceId: "primary:ada-transcript",
  adapterId: "web",
  mediaKind: "document",
  externalId: null,
  title: "Dr. Ada interview transcript",
  url: "https://example.test/ada-transcript",
  publisher: "Ada Institute",
  author: "Dr. Ada",
  publishedAt: "2025-02-01",
  language: "en",
  summary: "Dr. Ada said that confidence in a memory can exceed its accuracy. She distinguished confidence from independently verified recall.",
  thumbnailUrl: null,
  durationSec: null,
  metrics: {},
  sourceMetadata: {
    provenanceVerified: true,
    provenanceKind: "direct_transcript",
  },
};

const claimRelativeAuthoredSource = {
  ...transcriptSource,
  sourceId: "primary:ada-authored-article",
  adapterId: "primary",
  sourceMetadata: {},
};

const claimRelativeRequest = {
  frozenGraph,
  originalPrimaryRequiredClaimIds: ["claim-research", "claim-statement"],
  candidateSources: [academicSource, claimRelativeAuthoredSource],
  creatorProfile: {},
};

const claimRelativeContext =
  createEditorialPrimaryCoverageRepairContext(claimRelativeRequest);

assert.equal(
  claimRelativeContext.candidatePrimarySources.length,
  2,
  "an exact canonical author match may establish primary authority for an attributed statement",
);

const request = {
  frozenGraph,
  originalPrimaryRequiredClaimIds: ["claim-research", "claim-statement"],
  candidateSources: [academicSource, transcriptSource],
  creatorProfile: {},
};

const context = createEditorialPrimaryCoverageRepairContext(request);
assert.deepEqual(context.targetClaimIds, ["claim-research", "claim-statement"]);
assert.equal(context.candidatePrimarySources.length, 2);
assert.ok(context.candidateSpans.length >= 2);

const researchSpan = context.candidateSpans.find(
  (span) => span.sourceId === academicSource.sourceId,
);
const statementSpan = context.candidateSpans.find(
  (span) => span.sourceId === transcriptSource.sourceId,
);
assert.ok(researchSpan);
assert.ok(statementSpan);

const repaired = applyEditorialPrimaryCoverageRepair({
  context,
  selection: {
    repairs: [
      { claimId: "claim-research", spanId: researchSpan.spanId },
      { claimId: "claim-statement", spanId: statementSpan.spanId },
    ],
  },
});

assert.deepEqual(repaired.graph.claims, baseClaims);
assert.deepEqual(
  repaired.readiness.primarySourceRequiredClaimIds,
  ["claim-research", "claim-statement"],
);
assert.deepEqual(
  repaired.readiness.primarySourceCoveredClaimIds,
  ["claim-research", "claim-statement"],
);
assert.equal(
  repaired.readiness.reviewReasons.includes("PRIMARY_SOURCE_COVERAGE_REQUIRED"),
  false,
);
assert.deepEqual(
  repaired.graph.evidence.map((evidence) => evidence.excerpt),
  [researchSpan.text, statementSpan.text],
  "server must reconstruct exact canonical span text",
);
assert.deepEqual(
  repaired.graph.links.map((link) => link.stance),
  ["supports", "supports"],
);

const sharedSpanRepair = applyEditorialPrimaryCoverageRepair({
  context,
  selection: {
    repairs: [
      { claimId: "claim-research", spanId: researchSpan.spanId },
      { claimId: "claim-statement", spanId: researchSpan.spanId },
    ],
  },
});
assert.equal(
  sharedSpanRepair.graph.evidence.length,
  1,
  "one canonical span must create one evidence authority even when linked twice",
);
assert.equal(sharedSpanRepair.graph.links.length, 2);

assert.throws(
  () => applyEditorialPrimaryCoverageRepair({
    context,
    selection: {
      repairs: [{
        claimId: "claim-research",
        spanId: researchSpan.spanId,
        claim: { claimId: "claim-invented" },
      }],
    },
  }),
  /EDITORIAL_PRIMARY_COVERAGE_SELECTION_INVALID/,
  "provider cannot add a claim or any other graph field",
);

assert.throws(
  () => applyEditorialPrimaryCoverageRepair({
    context,
    selection: {
      repairs: [{
        claimId: "claim-research",
        spanId: researchSpan.spanId,
        excerpt: "provider-authored replacement",
      }],
    },
  }),
  /EDITORIAL_PRIMARY_COVERAGE_SELECTION_INVALID/,
  "provider cannot author or rewrite evidence excerpts",
);

assert.throws(
  () => applyEditorialPrimaryCoverageRepair({
    context,
    selection: {
      repairs: [{ claimId: "claim-invented", spanId: researchSpan.spanId }],
    },
  }),
  /EDITORIAL_PRIMARY_COVERAGE_TARGET_NOT_ALLOWED:claim-invented/,
);

assert.throws(
  () => applyEditorialPrimaryCoverageRepair({
    context,
    selection: {
      repairs: [{ claimId: "claim-research", spanId: "span-unknown" }],
    },
  }),
  /EDITORIAL_PRIMARY_COVERAGE_SPAN_NOT_ALLOWED:span-unknown/,
);

const partiallyResolved = applyEditorialPrimaryCoverageRepair({
  context,
  selection: {
    repairs: [{ claimId: "claim-research", spanId: researchSpan.spanId }],
  },
});

assert.deepEqual(
  partiallyResolved.unresolvedClaimIds,
  ["claim-statement"],
);
assert.deepEqual(
  partiallyResolved.excludedPrimaryClaimIds,
  ["claim-statement"],
);
assert.ok(
  partiallyResolved.graph.claims.some(
    (claim) => claim.claimId === "claim-research",
  ),
);
assert.ok(
  !partiallyResolved.graph.claims.some(
    (claim) => claim.claimId === "claim-statement",
  ),
  "unverified mandatory claim must not reach Script Planner authority",
);
assert.deepEqual(
  partiallyResolved.readiness.primarySourceRequiredClaimIds,
  ["claim-research"],
);
assert.deepEqual(
  partiallyResolved.readiness.primarySourceCoveredClaimIds,
  ["claim-research"],
);
assert.equal(
  partiallyResolved.readiness.reviewReasons.includes(
    "PRIMARY_SOURCE_COVERAGE_REQUIRED",
  ),
  false,
);

const fullyExcludedMandatoryClaims =
  applyEditorialPrimaryCoverageRepair({
    context,
    selection: { repairs: [] },
  });

assert.deepEqual(
  fullyExcludedMandatoryClaims.unresolvedClaimIds,
  ["claim-research", "claim-statement"],
);
assert.deepEqual(
  fullyExcludedMandatoryClaims.excludedPrimaryClaimIds,
  ["claim-research", "claim-statement"],
);
assert.deepEqual(
  fullyExcludedMandatoryClaims.graph.claims.map(
    (claim) => claim.claimId,
  ),
  ["claim-world"],
  "non-primary grounded claims remain available when unresolved mandatory claims are excluded",
);
assert.deepEqual(
  fullyExcludedMandatoryClaims.readiness.primarySourceRequiredClaimIds,
  [],
);
assert.deepEqual(
  fullyExcludedMandatoryClaims.readiness.primarySourceCoveredClaimIds,
  [],
);
assert.equal(
  fullyExcludedMandatoryClaims.readiness.reviewReasons.includes(
    "PRIMARY_SOURCE_COVERAGE_REQUIRED",
  ),
  false,
);

assert.throws(
  () => createEditorialPrimaryCoverageRepairContext({
    ...request,
    candidateSources: [{
      ...transcriptSource,
      sourceId: "primary:search-intent-only",
      adapterId: "primary",
      title: "Unrelated search result",
      publisher: "Unrelated Publisher",
      author: "Unrelated Author",
      sourceMetadata: {},
    }],
  }),
  /EDITORIAL_PRIMARY_COVERAGE_SOURCE_NOT_PRIMARY:primary:search-intent-only/,
  "primary search intent alone must not authorize evidence",
);

assert.throws(
  () => createEditorialPrimaryCoverageRepairContext({
    ...request,
    originalPrimaryRequiredClaimIds: ["claim-research"],
  }),
  /EDITORIAL_PRIMARY_COVERAGE_REQUIRED_CLAIMS_MISMATCH/,
  "the client cannot narrow canonical primary obligations",
);

const verbosePrimarySummary = Array.from(
  { length: 12 },
  (_, index) => `Researchers reported bounded observation number ${index + 1} from the original study.`,
).join(" ");
assert.throws(
  () => createEditorialPrimaryCoverageRepairContext({
    ...request,
    candidateSources: Array.from({ length: 6 }, (_, index) => ({
      ...academicSource,
      sourceId: `academic:verbose-${index + 1}`,
      externalId: `doi:10.1/verbose-${index + 1}`,
      url: `https://doi.org/10.1/verbose-${index + 1}`,
      title: `Verbose primary study ${index + 1}`,
      summary: verbosePrimarySummary,
    })),
  }),
  /EDITORIAL_PRIMARY_COVERAGE_CANDIDATE_LIMIT_EXCEEDED/,
  "more than 120 canonical candidate spans must remain fail-closed",
);

assert.throws(
  () => createEditorialPrimaryCoverageRepairContext({
    ...request,
    candidateSources: Array.from({ length: 41 }, (_, index) => ({
      ...academicSource,
      sourceId: `academic:source-limit-${index + 1}`,
      externalId: `doi:10.1/source-limit-${index + 1}`,
      url: `https://doi.org/10.1/source-limit-${index + 1}`,
      title: `Primary study ${index + 1}`,
    })),
  }),
  /EDITORIAL_PRIMARY_COVERAGE_CANDIDATE_EDITORIAL_SOURCES_LIMIT_EXCEEDED/,
  "the existing 40-source ceiling must remain fail-closed",
);

const emptyCandidateContext =
  createEditorialPrimaryCoverageRepairContext({
    ...request,
    candidateSources: [],
  });

assert.deepEqual(
  emptyCandidateContext.candidatePrimarySources,
  [],
);
assert.deepEqual(
  emptyCandidateContext.candidateSpans,
  [],
  "zero primary candidates must remain a valid repair context",
);

const emptyCandidateSafeResult =
  applyEditorialPrimaryCoverageRepair({
    context: emptyCandidateContext,
    selection: { repairs: [] },
  });

assert.deepEqual(
  emptyCandidateSafeResult.excludedPrimaryClaimIds,
  ["claim-research", "claim-statement"],
  "all still-unverified mandatory claims must be explicitly excluded",
);
assert.deepEqual(
  emptyCandidateSafeResult.graph.claims.map(
    (claim) => claim.claimId,
  ),
  ["claim-world"],
);
assert.equal(
  emptyCandidateSafeResult.readiness.reviewReasons.includes(
    "PRIMARY_SOURCE_COVERAGE_REQUIRED",
  ),
  false,
  "the derived script-safe graph must not retain unresolved primary obligations",
);

const route = fs.readFileSync(
  "app/api/creator-editorial-primary-coverage/route.ts",
  "utf8",
);
assert.match(route, /creator_editorial_primary_coverage_repair/);
assert.match(route, /additionalProperties:\s*false/);
assert.match(route, /required:\s*\["claimId",\s*"spanId"\]/);
assert.doesNotMatch(
  route.match(/name:\s*"creator_editorial_primary_coverage_repair"[\s\S]*?temperature:\s*0/)?.[0] || "",
  /canonicalGraph|claims:\s*\{|claimType:\s*\{|propositionKind:\s*\{|origin:\s*\{/,
  "repair response schema must not expose claim authority",
);
assert.match(route, /createEditorialScriptContext\(/);
assert.match(route, /CREATOR_EDITORIAL_PRIMARY_COVERAGE_REPAIR/);
assert.match(route, /CREATOR_EDITORIAL_PRIMARY_COVERAGE_REJECTED/);
for (const field of [
  "reasonCode",
  "frozenClaimCount",
  "originalRequiredClaimCount",
  "candidateSourceCount",
  "verifiedPrimaryCandidateSourceCount",
  "candidateSpanCount",
  "duplicateSourceIdCount",
  "duplicateCanonicalUrlCount",
  "recomputedRequiredClaimCount",
  "requiredIdsMatch",
]) {
  assert.match(route, new RegExp(`\\b${field}\\b`));
}
assert.match(
  route,
  /code:\s*"EDITORIAL_PRIMARY_COVERAGE_INVALID"[\s\S]*?detailCode:\s*diagnostic[\s\S]*?status:\s*400/,
  "the diagnostic must not change the existing external API rejection",
);

console.log("Stage 0.18A6L primary coverage augmentation tests passed.");
