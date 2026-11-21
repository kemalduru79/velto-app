import assert from "node:assert/strict";
import fs from "node:fs";
import {
  researchSourceQualifiesAsPrimaryForClaim,
  resolveClaimAuthority,
} from "../lib/research/claimAuthorityResolver.ts";
import {
  createResearchClaimEvidenceGraph,
} from "../lib/research/claimEvidenceGraph.ts";
import {
  applyEditorialPrimaryCoverageRepair,
  createEditorialPrimaryCoverageRepairContext,
} from "../lib/research/editorialPrimaryCoverageRepair.ts";
import {
  createResearchOrchestrationPlan,
} from "../lib/research/researchOrchestration.ts";
import {
  createScriptPlannerGroundingDiagnostics,
  normalizeScriptPlannerEditorialContext,
} from "../lib/research/scriptPlannerEditorialContext.ts";
import {
  createResearchTopicReadiness,
} from "../lib/research/topicEvidenceReadiness.ts";

const locator = {
  section: null,
  page: null,
  timecodeStartSec: null,
  timecodeEndSec: null,
};

function source(sourceId, options = {}) {
  return {
    sourceId,
    adapterId: options.adapterId || "web",
    mediaKind: options.mediaKind || "article",
    externalId: options.externalId === undefined ? sourceId : options.externalId,
    title: options.title || `Source ${sourceId}`,
    url: options.url || `https://example.test/${sourceId}`,
    publisher: options.publisher || "Example Publisher",
    author: options.author === undefined ? null : options.author,
    publishedAt: "2026-01-01",
    language: "en",
    summary: options.summary || "A bounded source summary.",
    thumbnailUrl: null,
    durationSec: null,
    metrics: {},
    sourceMetadata: options.sourceMetadata || {},
  };
}

function assessment(sourceId, directness = "secondary") {
  return {
    sourceId,
    directness,
    provenanceStatus: "complete",
    reviewStatus: "usable",
    reviewReasons: [],
  };
}

function claim(claimId, options = {}) {
  const propositionKind = options.propositionKind === undefined
    ? "world_state"
    : options.propositionKind;
  const origin = options.origin === undefined
    ? { attributedEntity: null, referencedWork: null }
    : options.origin;
  return {
    claimId,
    claimType: options.claimType || "FACT",
    text: options.text || `Claim ${claimId}`,
    ...(propositionKind === null ? {} : { propositionKind, origin }),
  };
}

function evidence(evidenceId, sourceId) {
  return {
    evidenceId,
    sourceId,
    excerpt: `Evidence ${evidenceId}`,
    contextNote: null,
    locator,
  };
}

function graph(input) {
  return createResearchClaimEvidenceGraph({
    sources: input.sources || [],
    claims: input.claims || [],
    evidence: input.evidence || [],
    links: input.links || [],
  });
}

function resolution(report, claimId) {
  const result = report.claims.find((item) => item.claimId === claimId);
  assert.ok(result, `missing authority result for ${claimId}`);
  return result;
}

// 1. Ordinary support is sufficient for a claim without primary obligation.
const secondary = source("source-secondary");
const supportedGraph = graph({
  sources: [secondary],
  claims: [claim("claim-supported")],
  evidence: [evidence("evidence-secondary", secondary.sourceId)],
  links: [{
    claimId: "claim-supported",
    evidenceId: "evidence-secondary",
    stance: "supports",
  }],
});
const supported = resolution(resolveClaimAuthority({
  graph: supportedGraph,
  sourceAssessments: [assessment(secondary.sourceId)],
}), "claim-supported");
assert.equal(supported.status, "SUPPORTED");
assert.equal(supported.requiresPrimary, false);
assert.deepEqual(supported.supportingEvidenceIds, ["evidence-secondary"]);
assert.deepEqual(supported.qualifyingPrimaryEvidenceIds, []);

// 2 and 9. Global primary assessment qualifies support even when the source
// has no claim-relative identity match.
const globalPrimaryClaim = claim("claim-global-primary", {
  propositionKind: "attributed_statement",
  origin: { attributedEntity: "Unrelated Named Speaker", referencedWork: null },
});
const globalPrimaryGraph = graph({
  sources: [secondary],
  claims: [globalPrimaryClaim],
  evidence: [evidence("evidence-global-primary", secondary.sourceId)],
  links: [{
    claimId: globalPrimaryClaim.claimId,
    evidenceId: "evidence-global-primary",
    stance: "supports",
  }],
});
const globalPrimary = resolution(resolveClaimAuthority({
  graph: globalPrimaryGraph,
  sourceAssessments: [assessment(secondary.sourceId, "primary")],
}), globalPrimaryClaim.claimId);
assert.equal(globalPrimary.status, "SUPPORTED_PRIMARY");
assert.deepEqual(globalPrimary.qualifyingPrimaryEvidenceIds, [
  "evidence-global-primary",
]);
assert.ok(globalPrimary.reasons.includes("GLOBAL_PRIMARY_SUPPORT"));

// 3 and 10. A globally secondary source remains primary for the exact claim
// when canonical attributed-entity identity matches.
const attributedSource = source("source-attributed", {
  author: "Dr. Ada Example",
  publisher: "Independent Archive",
});
const attributedClaim = claim("claim-attributed", {
  propositionKind: "attributed_statement",
  origin: { attributedEntity: "Dr. Ada Example", referencedWork: null },
});
const attributedGraph = graph({
  sources: [attributedSource],
  claims: [attributedClaim],
  evidence: [evidence("evidence-attributed", attributedSource.sourceId)],
  links: [{
    claimId: attributedClaim.claimId,
    evidenceId: "evidence-attributed",
    stance: "supports",
  }],
});
const attributed = resolution(resolveClaimAuthority({
  graph: attributedGraph,
  sourceAssessments: [assessment(attributedSource.sourceId, "secondary")],
}), attributedClaim.claimId);
assert.equal(attributed.status, "SUPPORTED_PRIMARY");
assert.ok(attributed.reasons.includes("CLAIM_RELATIVE_PRIMARY_SUPPORT"));

const attributedPrimaryTypeClaim = {
  ...attributedClaim,
  claimId: "claim-attributed-primary-type",
  claimType: "PRIMARY_SOURCE_CLAIM",
};
const attributedPrimaryTypeGraph = graph({
  sources: [attributedSource],
  claims: [attributedPrimaryTypeClaim],
  evidence: [evidence("evidence-attributed-primary-type", attributedSource.sourceId)],
  links: [{
    claimId: attributedPrimaryTypeClaim.claimId,
    evidenceId: "evidence-attributed-primary-type",
    stance: "supports",
  }],
});
const attributedPrimaryType = resolution(resolveClaimAuthority({
  graph: attributedPrimaryTypeGraph,
  sourceAssessments: [assessment(attributedSource.sourceId, "secondary")],
}), attributedPrimaryTypeClaim.claimId);
assert.equal(attributedPrimaryType.requiresPrimary, attributed.requiresPrimary);
assert.equal(attributedPrimaryType.status, attributed.status);

// A missing assessment does not invent global directness, while the existing
// conservative claim-relative identity rule remains available.
const missingAssessmentRelative = resolution(resolveClaimAuthority({
  graph: attributedGraph,
  sourceAssessments: [],
}), attributedClaim.claimId);
assert.equal(missingAssessmentRelative.status, "SUPPORTED_PRIMARY");
assert.ok(
  missingAssessmentRelative.reasons.includes(
    "CLAIM_RELATIVE_PRIMARY_SUPPORT",
  ),
);

// 4. Secondary support without a canonical origin match remains unresolved.
const mismatchedClaim = claim("claim-mismatch", {
  propositionKind: "attributed_statement",
  origin: { attributedEntity: "Different Speaker", referencedWork: null },
});
const mismatchGraph = graph({
  sources: [attributedSource],
  claims: [mismatchedClaim],
  evidence: [evidence("evidence-mismatch", attributedSource.sourceId)],
  links: [{
    claimId: mismatchedClaim.claimId,
    evidenceId: "evidence-mismatch",
    stance: "supports",
  }],
});
const mismatch = resolution(resolveClaimAuthority({
  graph: mismatchGraph,
  sourceAssessments: [assessment(attributedSource.sourceId)],
}), mismatchedClaim.claimId);
assert.equal(mismatch.status, "PRIMARY_REQUIRED_MISSING");
assert.deepEqual(mismatch.qualifyingPrimaryEvidenceIds, []);

// 5. Structural absence of support takes precedence over primary coverage.
const noSupportGraph = graph({
  sources: [],
  claims: [claim("claim-no-support", {
    propositionKind: "document_assertion",
    origin: { attributedEntity: null, referencedWork: "Archive Record" },
  })],
});
const noSupport = resolution(resolveClaimAuthority({
  graph: noSupportGraph,
  sourceAssessments: [],
}), "claim-no-support");
assert.equal(noSupport.status, "UNSUPPORTED");
assert.equal(noSupport.requiresPrimary, true);
assert.deepEqual(noSupport.reasons, [
  "NO_SUPPORTING_EVIDENCE",
  "PRIMARY_REQUIRED_NO_QUALIFYING_PRIMARY",
]);

// 6-7. Contradicting and contextual evidence never becomes support.
for (const stance of ["contradicts", "contextualizes"]) {
  const stanceClaimId = `claim-${stance}`;
  const stanceEvidenceId = `evidence-${stance}`;
  const stanceResult = resolution(resolveClaimAuthority({
    graph: graph({
      sources: [secondary],
      claims: [claim(stanceClaimId)],
      evidence: [evidence(stanceEvidenceId, secondary.sourceId)],
      links: [{ claimId: stanceClaimId, evidenceId: stanceEvidenceId, stance }],
    }),
    sourceAssessments: [assessment(secondary.sourceId, "primary")],
  }), stanceClaimId);
  assert.equal(stanceResult.status, "UNSUPPORTED");
  assert.deepEqual(stanceResult.supportingEvidenceIds, []);
}

// 8. A primary retrieval adapter is intent, not authority.
const primaryLaneSource = source("source-primary-lane", {
  adapterId: "primary",
});
const laneClaim = claim("claim-primary-lane", {
  propositionKind: "document_assertion",
  origin: { attributedEntity: null, referencedWork: "Different Work" },
});
const laneGraph = graph({
  sources: [primaryLaneSource],
  claims: [laneClaim],
  evidence: [evidence("evidence-primary-lane", primaryLaneSource.sourceId)],
  links: [{
    claimId: laneClaim.claimId,
    evidenceId: "evidence-primary-lane",
    stance: "supports",
  }],
});
assert.equal(resolution(resolveClaimAuthority({
  graph: laneGraph,
  sourceAssessments: [assessment(primaryLaneSource.sourceId, "secondary")],
}), laneClaim.claimId).status, "PRIMARY_REQUIRED_MISSING");
assert.ok(
  createResearchOrchestrationPlan({
    subject: "A primary claim",
    claimType: "PRIMARY_SOURCE_CLAIM",
  }).lanes.some((lane) => lane.purpose === "primary_source"),
  "primary search remains retrieval strategy without becoming authority",
);

// 11. The same source/evidence may be primary for one claim and secondary for
// another because canonical origin identity is claim-relative.
const matchingClaim = attributedClaim;
const nonMatchingClaim = claim("claim-other-speaker", {
  propositionKind: "attributed_statement",
  origin: { attributedEntity: "Someone Else", referencedWork: null },
});
const sharedEvidenceGraph = graph({
  sources: [attributedSource],
  claims: [nonMatchingClaim, matchingClaim],
  evidence: [evidence("evidence-shared", attributedSource.sourceId)],
  links: [
    { claimId: matchingClaim.claimId, evidenceId: "evidence-shared", stance: "supports" },
    { claimId: nonMatchingClaim.claimId, evidenceId: "evidence-shared", stance: "supports" },
  ],
});
const sharedReport = resolveClaimAuthority({
  graph: sharedEvidenceGraph,
  sourceAssessments: [assessment(attributedSource.sourceId)],
});
assert.equal(resolution(sharedReport, matchingClaim.claimId).status, "SUPPORTED_PRIMARY");
assert.equal(resolution(sharedReport, nonMatchingClaim.claimId).status, "PRIMARY_REQUIRED_MISSING");

// 12-13. Canonical proposition authority overrides claimType; genuinely legacy
// claims alone use the historical claimType fallback.
const canonicalOverrideClaim = claim("claim-canonical-override", {
  claimType: "PRIMARY_SOURCE_CLAIM",
  propositionKind: "expert_synthesis",
});
const legacyPrimaryClaim = claim("claim-legacy-primary", {
  claimType: "PRIMARY_SOURCE_CLAIM",
  propositionKind: null,
});
const legacyFactClaim = claim("claim-legacy-fact", {
  claimType: "FACT",
  propositionKind: null,
});
const legacyGraph = graph({
  sources: [secondary],
  claims: [legacyFactClaim, legacyPrimaryClaim, canonicalOverrideClaim],
  evidence: [
    evidence("evidence-legacy-fact", secondary.sourceId),
    evidence("evidence-legacy-primary", secondary.sourceId),
    evidence("evidence-canonical-override", secondary.sourceId),
  ],
  links: [
    { claimId: legacyFactClaim.claimId, evidenceId: "evidence-legacy-fact", stance: "supports" },
    { claimId: legacyPrimaryClaim.claimId, evidenceId: "evidence-legacy-primary", stance: "supports" },
    { claimId: canonicalOverrideClaim.claimId, evidenceId: "evidence-canonical-override", stance: "supports" },
  ],
});
const legacyReport = resolveClaimAuthority({
  graph: legacyGraph,
  sourceAssessments: [assessment(secondary.sourceId)],
});
assert.equal(resolution(legacyReport, canonicalOverrideClaim.claimId).requiresPrimary, false);
assert.equal(resolution(legacyReport, canonicalOverrideClaim.claimId).status, "SUPPORTED");
assert.equal(resolution(legacyReport, legacyPrimaryClaim.claimId).requiresPrimary, true);
assert.equal(resolution(legacyReport, legacyPrimaryClaim.claimId).status, "PRIMARY_REQUIRED_MISSING");
assert.equal(resolution(legacyReport, legacyFactClaim.claimId).requiresPrimary, false);

assert.throws(
  () => graph({
    claims: [claim("claim-invalid-world", {
      claimType: "PRIMARY_SOURCE_CLAIM",
      propositionKind: "world_state",
    })],
  }),
  /CLAIM_PRIMARY_SOURCE_WORLD_STATE_INVALID/,
);

// 14-15. Duplicate/conflicting and orphan assessments fail closed.
assert.throws(
  () => resolveClaimAuthority({
    graph: supportedGraph,
    sourceAssessments: [
      assessment(secondary.sourceId, "secondary"),
      assessment(secondary.sourceId, "primary"),
    ],
  }),
  /CLAIM_AUTHORITY_SOURCE_ASSESSMENT_DUPLICATE:source-secondary/,
);
assert.throws(
  () => resolveClaimAuthority({
    graph: supportedGraph,
    sourceAssessments: [assessment("source-orphan")],
  }),
  /CLAIM_AUTHORITY_SOURCE_ASSESSMENT_ORPHAN:source-orphan/,
);
assert.throws(
  () => researchSourceQualifiesAsPrimaryForClaim({
    source: secondary,
    claim: supportedGraph.claims[0],
    sourceAssessment: assessment("source-other", "primary"),
  }),
  /CLAIM_AUTHORITY_SOURCE_ASSESSMENT_MISMATCH:source-secondary/,
);
assert.throws(
  () => resolveClaimAuthority({
    graph: {
      ...supportedGraph,
      links: [{
        claimId: "claim-supported",
        evidenceId: "missing-evidence",
        stance: "supports",
      }],
    },
    sourceAssessments: [assessment(secondary.sourceId)],
  }),
  /LINK_EVIDENCE_MISSING:missing-evidence/,
);

// 16. Explicit canonical sorting makes input order irrelevant.
const orderSources = [secondary, attributedSource];
const orderClaims = [claim("claim-z"), attributedClaim];
const orderEvidence = [
  evidence("evidence-z", secondary.sourceId),
  evidence("evidence-a", attributedSource.sourceId),
];
const orderLinks = [
  { claimId: "claim-z", evidenceId: "evidence-z", stance: "supports" },
  { claimId: attributedClaim.claimId, evidenceId: "evidence-a", stance: "supports" },
];
const orderedReport = resolveClaimAuthority({
  graph: graph({
    sources: orderSources,
    claims: orderClaims,
    evidence: orderEvidence,
    links: orderLinks,
  }),
  sourceAssessments: [
    assessment(secondary.sourceId),
    assessment(attributedSource.sourceId),
  ],
});
const reversedReport = resolveClaimAuthority({
  graph: graph({
    sources: [...orderSources].reverse(),
    claims: [...orderClaims].reverse(),
    evidence: [...orderEvidence].reverse(),
    links: [...orderLinks].reverse(),
  }),
  sourceAssessments: [
    assessment(attributedSource.sourceId),
    assessment(secondary.sourceId),
  ],
});
assert.deepEqual(reversedReport, orderedReport);

// 17. Topic readiness consumes exactly the resolver's obligation/coverage.
const attributedReadiness = createResearchTopicReadiness({
  graph: attributedGraph,
  sourceAssessments: [assessment(attributedSource.sourceId)],
});
assert.deepEqual(attributedReadiness.primarySourceRequiredClaimIds, [
  attributedClaim.claimId,
]);
assert.deepEqual(attributedReadiness.primarySourceCoveredClaimIds, [
  attributedClaim.claimId,
]);
assert.equal(
  attributedReadiness.reviewReasons.includes(
    "PRIMARY_SOURCE_COVERAGE_REQUIRED",
  ),
  false,
);

// 18-19. Primary repair consumes resolver-derived readiness and retains the
// existing zero-candidate safe-exclusion policy outside the resolver.
const repairOrdinaryClaim = claim("claim-safe-ordinary");
const repairPrimaryClaim = claim("claim-safe-primary", {
  propositionKind: "document_assertion",
  origin: { attributedEntity: null, referencedWork: "Missing Primary Work" },
});
const repairContext = createEditorialPrimaryCoverageRepairContext({
  frozenGraph: graph({
    sources: [secondary],
    claims: [repairOrdinaryClaim, repairPrimaryClaim],
    evidence: [{
      ...evidence("evidence-safe-ordinary", secondary.sourceId),
      excerpt: secondary.summary,
    }],
    links: [{
      claimId: repairOrdinaryClaim.claimId,
      evidenceId: "evidence-safe-ordinary",
      stance: "supports",
    }],
  }),
  originalPrimaryRequiredClaimIds: [repairPrimaryClaim.claimId],
  candidateSources: [],
  creatorProfile: {},
});
assert.deepEqual(repairContext.targetClaimIds, [repairPrimaryClaim.claimId]);
assert.equal(repairContext.candidateSpans.length, 0);
const safeExclusion = applyEditorialPrimaryCoverageRepair({
  context: repairContext,
  selection: { repairs: [] },
});
assert.deepEqual(safeExclusion.excludedPrimaryClaimIds, [repairPrimaryClaim.claimId]);
assert.deepEqual(safeExclusion.graph.claims.map((item) => item.claimId), [
  repairOrdinaryClaim.claimId,
]);
assert.equal(
  safeExclusion.readiness.reviewReasons.includes(
    "PRIMARY_SOURCE_COVERAGE_REQUIRED",
  ),
  false,
);

// 20-21. Script Planner diagnostics use the same claim-relative authority and
// reject a readiness payload that reports a different primary truth.
const plannerRawContext = {
  version: "0.10H-2E",
  editorialConstitution: "Preserve evidence authority.",
  readiness: {
    status: "ready",
    editorialReadinessScore: 100,
    reviewReasons: [],
    primarySourceRequiredClaimIds: [attributedClaim.claimId],
    primarySourceCoveredClaimIds: [attributedClaim.claimId],
  },
  claims: [{
    ...attributedClaim,
    supportingEvidenceIds: ["evidence-attributed"],
    counterEvidenceIds: [],
    contextualEvidenceIds: [],
  }],
  evidence: [evidence("evidence-attributed", attributedSource.sourceId)],
  sources: [{
    sourceId: attributedSource.sourceId,
    title: attributedSource.title,
    url: attributedSource.url,
    publisher: attributedSource.publisher,
    author: attributedSource.author,
    publishedAt: attributedSource.publishedAt,
    directness: "secondary",
    reviewStatus: "usable",
    searchLane: attributedSource.adapterId,
    sourceKind: attributedSource.mediaKind,
  }],
};
const plannerContext = normalizeScriptPlannerEditorialContext(plannerRawContext);
assert.ok(plannerContext);
const plannerDiagnostics = createScriptPlannerGroundingDiagnostics(plannerContext);
assert.deepEqual(plannerDiagnostics.primaryRequiredClaimIds, [
  attributedClaim.claimId,
]);
assert.deepEqual(plannerDiagnostics.primaryCoveredClaimIds, [
  attributedClaim.claimId,
]);
assert.throws(
  () => normalizeScriptPlannerEditorialContext({
    ...plannerRawContext,
    readiness: {
      ...plannerRawContext.readiness,
      primarySourceCoveredClaimIds: [],
    },
  }),
  /EDITORIAL_CONTEXT_PRIMARY_AUTHORITY_MISMATCH/,
);

const clientSource = fs.readFileSync(
  "lib/research/creatorEditorialPipeline.client.ts",
  "utf8",
);
assert.match(clientSource, /researchSourceQualifiesAsPrimaryForClaim/);
assert.equal(
  clientSource.includes("researchSourceIsPrimaryForClaim"),
  false,
  "client acquisition must consume canonical authority compatibility helper",
);

console.log("Stage 0.19C claim authority resolver tests passed.");
