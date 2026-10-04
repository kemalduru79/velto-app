import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createResearchClaimEvidenceGraph,
  researchClaimRequiresPrimarySource,
} from "../lib/research/claimEvidenceGraph.ts";
import {
  ClaimPropositionAuthorityDisagreementError,
  reconcileClaimPropositionAuthorities,
} from "../lib/research/claimPropositionAuthority.ts";
import { createValidatedEditorialAnalysis } from "../lib/research/editorialAnalysisContract.ts";
import { repairCollapsedCanonicalEditorialSelection } from "../lib/research/editorialCanonicalSelectionRepair.ts";
import { editorialReadinessRequiresPrimaryAcquisition } from "../lib/research/creatorEditorialPipeline.client.ts";
import { classifyResearchSourceDirectness } from "../lib/research/sourceAssessment.ts";
import {
  createScriptPlannerGroundingDiagnostics,
  normalizeScriptPlannerEditorialContext,
} from "../lib/research/scriptPlannerEditorialContext.ts";
import { createResearchTopicReadiness } from "../lib/research/topicEvidenceReadiness.ts";

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
    externalId: sourceId,
    title: options.title || `Source ${sourceId}`,
    url: `https://example.test/${sourceId}`,
    publisher: "Example",
    author: null,
    publishedAt: "2026-01-01",
    language: "en",
    summary: options.summary || "Ada Example said the system changed in the official interview.",
    thumbnailUrl: null,
    durationSec: null,
    metrics: {},
    sourceMetadata: options.sourceMetadata || {},
  };
}

const attributedOrigin = {
  attributedEntity: "Ada Example",
  referencedWork: "Official interview",
};
const emptyOrigin = { attributedEntity: null, referencedWork: null };

const initialClaim = {
  claimId: "claim-1",
  claimType: "FACT",
  text: "Ada Example said the system changed.",
  propositionKind: "attributed_statement",
  origin: attributedOrigin,
  untouchedProviderField: "preserved",
};

const reconciled = reconcileClaimPropositionAuthorities({
  initialClaims: [initialClaim],
  adjudication: {
    claims: [{
      claimId: "claim-1",
      propositionKind: "attributed_statement",
      origin: attributedOrigin,
    }],
  },
});
assert.equal(reconciled[0].claimId, initialClaim.claimId);
assert.equal(reconciled[0].claimType, initialClaim.claimType);
assert.equal(reconciled[0].text, initialClaim.text);
assert.equal(reconciled[0].untouchedProviderField, "preserved");
assert.deepEqual(reconciled[0].origin, attributedOrigin);

const correctedInvalidInitial = reconcileClaimPropositionAuthorities({
  initialClaims: [{
    claimId: "claim-corrected",
    claimType: "FACT",
    text: "Ada Example said the system changed.",
    propositionKind: "world_state",
    origin: attributedOrigin,
  }],
  adjudication: {
    claims: [{
      claimId: "claim-corrected",
      propositionKind: "attributed_statement",
      origin: attributedOrigin,
    }],
  },
});
assert.equal(
  correctedInvalidInitial[0].propositionKind,
  "attributed_statement",
);
assert.deepEqual(
  correctedInvalidInitial[0].origin,
  attributedOrigin,
);

const upgradedDocumentAssertion = reconcileClaimPropositionAuthorities({
  initialClaims: [{
    claimId: "claim-document-upgrade",
    claimType: "FACT",
    text: "The filing records the changed policy.",
    propositionKind: "world_state",
    origin: emptyOrigin,
  }],
  adjudication: {
    claims: [{
      claimId: "claim-document-upgrade",
      propositionKind: "document_assertion",
      origin: {
        attributedEntity: null,
        referencedWork: "Official policy filing",
      },
    }],
  },
});
assert.equal(
  upgradedDocumentAssertion[0].propositionKind,
  "document_assertion",
);
assert.deepEqual(upgradedDocumentAssertion[0].origin, {
  attributedEntity: null,
  referencedWork: "Official policy filing",
});
assert.equal(
  researchClaimRequiresPrimarySource(upgradedDocumentAssertion[0]),
  true,
);

const sameWorkSemanticRefinement = reconcileClaimPropositionAuthorities({
  initialClaims: [{
    claimId: "claim-same-work-refinement",
    claimType: "THEORY",
    text: "Post-work theorists argue that the modern ideology of work is no longer suited to contemporary challenges.",
    propositionKind: "original_research_result",
    origin: {
      attributedEntity: null,
      referencedWork: "Original post-work paper",
    },
  }],
  adjudication: {
    claims: [{
      claimId: "claim-same-work-refinement",
      propositionKind: "document_assertion",
      origin: {
        attributedEntity: null,
        referencedWork: "Original post-work paper",
      },
    }],
  },
});

assert.equal(
  sameWorkSemanticRefinement[0].propositionKind,
  "document_assertion",
  "the adjudicator may refine document-vs-result semantics when canonical work authority is unchanged",
);
assert.deepEqual(
  sameWorkSemanticRefinement[0].origin,
  {
    attributedEntity: null,
    referencedWork: "Original post-work paper",
  },
);
assert.equal(
  researchClaimRequiresPrimarySource(sameWorkSemanticRefinement[0]),
  true,
  "same-work semantic refinement must preserve the primary-source obligation",
);

const sameOriginNonPrimaryRefinement =
  reconcileClaimPropositionAuthorities({
    initialClaims: [{
      claimId: "claim-non-primary-refinement",
      claimType: "EDITORIAL_INFERENCE",
      text: "A post-work society may require new sources of identity and purpose.",
      propositionKind: "editorial_inference",
      origin: {
        attributedEntity: "Named thinkers",
        referencedWork: "Canonical commentary source",
      },
    }],
    adjudication: {
      claims: [{
        claimId: "claim-non-primary-refinement",
        propositionKind: "expert_synthesis",
        origin: {
          attributedEntity: "Named thinkers",
          referencedWork: "Canonical commentary source",
        },
      }],
    },
  });

assert.equal(
  sameOriginNonPrimaryRefinement[0].propositionKind,
  "expert_synthesis",
  "same-origin expert-synthesis/editorial-inference refinement may be adjudicated",
);
assert.deepEqual(
  sameOriginNonPrimaryRefinement[0].origin,
  {
    attributedEntity: "Named thinkers",
    referencedWork: "Canonical commentary source",
  },
);
assert.equal(
  researchClaimRequiresPrimarySource(
    sameOriginNonPrimaryRefinement[0],
  ),
  false,
  "non-primary semantic refinement must not create a primary-source obligation",
);

const upgradedAttributedStatement = reconcileClaimPropositionAuthorities({
  initialClaims: [{
    claimId: "claim-attribution-upgrade",
    claimType: "FACT",
    text: "Ada Example said the system changed.",
    propositionKind: "world_state",
    origin: emptyOrigin,
  }],
  adjudication: {
    claims: [{
      claimId: "claim-attribution-upgrade",
      propositionKind: "attributed_statement",
      origin: attributedOrigin,
    }],
  },
});
assert.equal(
  upgradedAttributedStatement[0].propositionKind,
  "attributed_statement",
);
assert.deepEqual(upgradedAttributedStatement[0].origin, attributedOrigin);

assert.throws(
  () => reconcileClaimPropositionAuthorities({
    initialClaims: [initialClaim],
    adjudication: {
      claims: [{
        claimId: "claim-1",
        propositionKind: "world_state",
        origin: emptyOrigin,
      }],
    },
  }),
  /EDITORIAL_CLAIM_ORIGIN_DISAGREEMENT:claim-1/,
  "a primary-bearing initial classification cannot be silently downgraded",
);
assert.throws(
  () => reconcileClaimPropositionAuthorities({
    initialClaims: [initialClaim],
    adjudication: {
      claims: [{
        claimId: "claim-1",
        propositionKind: "document_assertion",
        origin: {
          attributedEntity: null,
          referencedWork: "Official policy filing",
        },
      }],
    },
  }),
  /EDITORIAL_CLAIM_ORIGIN_DISAGREEMENT:claim-1/,
  "one valid primary-bearing semantic authority cannot be silently substituted for another",
);

const boundedDisagreementText = `  A named researcher reports   a finding. ${"x".repeat(700)}`;
let structuredDisagreement;
try {
  reconcileClaimPropositionAuthorities({
    initialClaims: [{
      claimId: "claim-structured-disagreement",
      claimType: "THEORY",
      text: boundedDisagreementText,
      propositionKind: "document_assertion",
      origin: attributedOrigin,
    }],
    adjudication: {
      claims: [{
        claimId: "claim-structured-disagreement",
        propositionKind: "attributed_statement",
        origin: attributedOrigin,
      }],
    },
  });
  assert.fail("primary-bearing semantic substitution must remain fail-closed");
} catch (error) {
  assert.ok(error instanceof ClaimPropositionAuthorityDisagreementError);
  structuredDisagreement = error.disagreement;
  assert.match(error.message, /^EDITORIAL_CLAIM_ORIGIN_DISAGREEMENT:claim-structured-disagreement:/);
}
assert.deepEqual(structuredDisagreement, {
  claimId: "claim-structured-disagreement",
  claimType: "THEORY",
  claimText: boundedDisagreementText.replace(/\s+/g, " ").trim().slice(0, 600),
  initialKind: "document_assertion",
  initialOrigin: attributedOrigin,
  adjudicatedKind: "attributed_statement",
  adjudicatedOrigin: attributedOrigin,
  kindMatches: false,
  originMatches: true,
  initialRequiresPrimary: true,
  adjudicatedRequiresPrimary: true,
});
assert.equal(structuredDisagreement.claimText.length, 600);
assert.throws(
  () => reconcileClaimPropositionAuthorities({
    initialClaims: [{
      claimId: "claim-non-primary-substitution",
      claimType: "FACT",
      text: "The system changed.",
      propositionKind: "world_state",
      origin: emptyOrigin,
    }],
    adjudication: {
      claims: [{
        claimId: "claim-non-primary-substitution",
        propositionKind: "editorial_inference",
        origin: emptyOrigin,
      }],
    },
  }),
  /EDITORIAL_CLAIM_ORIGIN_DISAGREEMENT:claim-non-primary-substitution/,
  "one valid non-primary semantic authority cannot be silently substituted for another",
);
assert.throws(
  () => reconcileClaimPropositionAuthorities({
    initialClaims: [{
      ...initialClaim,
      propositionKind: "ambiguous",
      origin: emptyOrigin,
    }],
    adjudication: {
      claims: [{
        claimId: "claim-1",
        propositionKind: "ambiguous",
        origin: emptyOrigin,
      }],
    },
  }),
  /EDITORIAL_CLAIM_ORIGIN_AMBIGUOUS:claim-1/,
  "agreement on unresolved ambiguity remains fail-closed",
);
assert.throws(
  () => reconcileClaimPropositionAuthorities({
    initialClaims: [{
      claimId: "claim-original-type-validation",
      claimType: "PRIMARY_SOURCE_CLAIM",
      text: "A direct-source claim.",
      propositionKind: "world_state",
      origin: attributedOrigin,
    }],
    adjudication: {
      claims: [{
        claimId: "claim-original-type-validation",
        propositionKind: "world_state",
        origin: emptyOrigin,
      }],
    },
  }),
  /CLAIM_PRIMARY_SOURCE_WORLD_STATE_INVALID:claim-original-type-validation/,
  "adjudicated authority is strictly validated with the original claimType",
);

const contractSource = source("source-secondary");
const acceptedGraph = createValidatedEditorialAnalysis({
  sources: [contractSource],
  requirePropositionAuthority: true,
  proposal: {
    claims: [initialClaim],
    evidence: [{
      evidenceId: "evidence-1",
      sourceId: contractSource.sourceId,
      excerpt: contractSource.summary,
      contextNote: null,
    }],
    links: [{ claimId: "claim-1", evidenceId: "evidence-1", stance: "supports" }],
  },
});
assert.equal(acceptedGraph.claims[0].propositionKind, "attributed_statement");
assert.equal(researchClaimRequiresPrimarySource(acceptedGraph.claims[0]), true);

const provisionalGraph = createValidatedEditorialAnalysis({
  sources: [contractSource],
  requirePropositionAuthority: true,
  allowAmbiguousPropositionAuthority: true,
  provisionalPropositionAuthority: true,
  proposal: {
    claims: [{
      claimId: "provisional-world-origin",
      claimType: "FACT",
      text: "Ada Example said the system changed.",
      propositionKind: "world_state",
      origin: attributedOrigin,
    }],
    evidence: [],
    links: [],
  },
});
assert.equal(
  provisionalGraph.claims[0].propositionKind,
  "world_state",
);
assert.deepEqual(
  provisionalGraph.claims[0].origin,
  attributedOrigin,
);

assert.throws(
  () => createValidatedEditorialAnalysis({
    sources: [contractSource],
    requirePropositionAuthority: true,
    proposal: {
      claims: [{ claimId: "missing", claimType: "FACT", text: "Missing authority." }],
      evidence: [],
      links: [],
    },
  }),
  /CLAIM_PROPOSITION_AUTHORITY_REQUIRED:missing/,
);
assert.throws(
  () => createValidatedEditorialAnalysis({
    sources: [contractSource],
    requirePropositionAuthority: true,
    proposal: {
      claims: [{
        claimId: "missing-entity",
        claimType: "FACT",
        text: "Someone said something.",
        propositionKind: "attributed_statement",
        origin: emptyOrigin,
      }],
      evidence: [],
      links: [],
    },
  }),
  /CLAIM_ATTRIBUTED_ENTITY_REQUIRED:missing-entity/,
);
assert.throws(
  () => createValidatedEditorialAnalysis({
    sources: [contractSource],
    requirePropositionAuthority: true,
    proposal: {
      claims: [{
        claimId: "missing-work",
        claimType: "RESEARCH_FINDING",
        text: "A study found a result.",
        propositionKind: "original_research_result",
        origin: emptyOrigin,
      }],
      evidence: [],
      links: [],
    },
  }),
  /CLAIM_REFERENCED_WORK_REQUIRED:missing-work/,
);
assert.throws(
  () => createValidatedEditorialAnalysis({
    sources: [contractSource],
    requirePropositionAuthority: true,
    proposal: {
      claims: [{
        claimId: "invalid-primary-world",
        claimType: "PRIMARY_SOURCE_CLAIM",
        text: "A world-state claim.",
        propositionKind: "world_state",
        origin: emptyOrigin,
      }],
      evidence: [],
      links: [],
    },
  }),
  /CLAIM_PRIMARY_SOURCE_WORLD_STATE_INVALID:invalid-primary-world/,
);
assert.throws(
  () => createValidatedEditorialAnalysis({
    sources: [contractSource],
    requirePropositionAuthority: true,
    proposal: {
      claims: [{
        claimId: "invalid-world-origin",
        claimType: "FACT",
        text: "A world-state claim.",
        propositionKind: "world_state",
        origin: attributedOrigin,
      }],
      evidence: [],
      links: [],
    },
  }),
  /CLAIM_WORLD_STATE_ORIGIN_INVALID:invalid-world-origin/,
);

const legacyPrimary = createValidatedEditorialAnalysis({
  sources: [contractSource],
  proposal: {
    claims: [{ claimId: "legacy-primary", claimType: "PRIMARY_SOURCE_CLAIM", text: "Legacy direct-source claim." }],
    evidence: [],
    links: [],
  },
});
const legacyFact = createValidatedEditorialAnalysis({
  sources: [contractSource],
  proposal: {
    claims: [{ claimId: "legacy-fact", claimType: "FACT", text: "Legacy fact." }],
    evidence: [],
    links: [],
  },
});
assert.equal(researchClaimRequiresPrimarySource(legacyPrimary.claims[0]), true);
assert.equal(researchClaimRequiresPrimarySource(legacyFact.claims[0]), false);

function graphForClaimType(claimType, evidenceSource = contractSource) {
  return createResearchClaimEvidenceGraph({
    sources: [evidenceSource],
    claims: [{
      claimId: "claim-equivalent",
      claimType,
      text: "Ada Example said the system changed.",
      propositionKind: "attributed_statement",
      origin: attributedOrigin,
    }],
    evidence: [{
      evidenceId: "evidence-equivalent",
      sourceId: evidenceSource.sourceId,
      excerpt: evidenceSource.summary,
      contextNote: null,
      locator,
    }],
    links: [{
      claimId: "claim-equivalent",
      evidenceId: "evidence-equivalent",
      stance: "supports",
    }],
  });
}

const secondaryAssessment = [{
  sourceId: contractSource.sourceId,
  directness: "secondary",
  provenanceStatus: "complete",
  reviewStatus: "usable",
  reviewReasons: [],
}];
const factReadiness = createResearchTopicReadiness({
  graph: graphForClaimType("FACT"),
  sourceAssessments: secondaryAssessment,
});
const primaryTypeReadiness = createResearchTopicReadiness({
  graph: graphForClaimType("PRIMARY_SOURCE_CLAIM"),
  sourceAssessments: secondaryAssessment,
});
assert.deepEqual(
  factReadiness.primarySourceRequiredClaimIds,
  primaryTypeReadiness.primarySourceRequiredClaimIds,
);
assert.deepEqual(factReadiness.primarySourceRequiredClaimIds, ["claim-equivalent"]);
assert.ok(factReadiness.reviewReasons.includes("PRIMARY_SOURCE_COVERAGE_REQUIRED"));
assert.ok(primaryTypeReadiness.reviewReasons.includes("PRIMARY_SOURCE_COVERAGE_REQUIRED"));
assert.equal(editorialReadinessRequiresPrimaryAcquisition(factReadiness), true);
assert.equal(editorialReadinessRequiresPrimaryAcquisition(primaryTypeReadiness), true);

const normalizedPlannerContext = normalizeScriptPlannerEditorialContext({
  version: "0.10H-2E",
  editorialConstitution: "Preserve grounded proposition authority.",
  readiness: {
    status: "review",
    editorialReadinessScore: 80,
    reviewReasons: ["PRIMARY_SOURCE_COVERAGE_REQUIRED"],
    primarySourceRequiredClaimIds: ["claim-equivalent"],
    primarySourceCoveredClaimIds: [],
  },
  claims: [{
    ...graphForClaimType("FACT").claims[0],
    supportingEvidenceIds: ["evidence-equivalent"],
    counterEvidenceIds: [],
    contextualEvidenceIds: [],
  }],
  evidence: graphForClaimType("FACT").evidence,
  sources: [{
    sourceId: contractSource.sourceId,
    title: contractSource.title,
    url: contractSource.url,
    publisher: contractSource.publisher,
    author: contractSource.author,
    publishedAt: contractSource.publishedAt,
    directness: "secondary",
    reviewStatus: "usable",
    searchLane: "web",
    sourceKind: "article",
  }],
});
assert.ok(normalizedPlannerContext);
assert.equal(normalizedPlannerContext.claims[0].propositionKind, "attributed_statement");
assert.deepEqual(
  createScriptPlannerGroundingDiagnostics(normalizedPlannerContext).primaryRequiredClaimIds,
  ["claim-equivalent"],
);

const worldStateReadiness = createResearchTopicReadiness({
  graph: createResearchClaimEvidenceGraph({
    sources: [contractSource],
    claims: [{
      claimId: "claim-world",
      claimType: "FACT",
      text: "The system changed.",
      propositionKind: "world_state",
      origin: emptyOrigin,
    }],
    evidence: [{
      evidenceId: "evidence-world",
      sourceId: contractSource.sourceId,
      excerpt: contractSource.summary,
      contextNote: null,
      locator,
    }],
    links: [{ claimId: "claim-world", evidenceId: "evidence-world", stance: "supports" }],
  }),
  sourceAssessments: secondaryAssessment,
});
assert.deepEqual(worldStateReadiness.primarySourceRequiredClaimIds, []);
assert.equal(editorialReadinessRequiresPrimaryAcquisition(worldStateReadiness), false);

const canonicalDocumentSource = source("web:https://publisher.test/original-work", {
  adapterId: "web",
  mediaKind: "webpage",
  title: "Original Work",
  summary: "The original work directly states the proposition.",
});

assert.equal(
  classifyResearchSourceDirectness(canonicalDocumentSource).directness,
  "secondary",
  "web retrieval alone must remain globally secondary",
);

const canonicalDocumentGraph = createResearchClaimEvidenceGraph({
  sources: [canonicalDocumentSource],
  claims: [{
    claimId: "claim-canonical-document",
    claimType: "THEORY",
    text: "The original work advances a specific post-work argument.",
    propositionKind: "document_assertion",
    origin: {
      attributedEntity: null,
      referencedWork: canonicalDocumentSource.sourceId,
    },
  }],
  evidence: [{
    evidenceId: "evidence-canonical-document",
    sourceId: canonicalDocumentSource.sourceId,
    excerpt: canonicalDocumentSource.summary,
    contextNote: null,
    locator,
  }],
  links: [{
    claimId: "claim-canonical-document",
    evidenceId: "evidence-canonical-document",
    stance: "supports",
  }],
});

const canonicalDocumentReadiness = createResearchTopicReadiness({
  graph: canonicalDocumentGraph,
  sourceAssessments: [{
    sourceId: canonicalDocumentSource.sourceId,
    directness: "secondary",
    provenanceStatus: "complete",
    reviewStatus: "usable",
    reviewReasons: [],
  }],
});

assert.deepEqual(
  canonicalDocumentReadiness.primarySourceRequiredClaimIds,
  ["claim-canonical-document"],
);
assert.deepEqual(
  canonicalDocumentReadiness.primarySourceCoveredClaimIds,
  ["claim-canonical-document"],
  "an exact canonical referencedWork/sourceId match must satisfy claim-relative primary authority",
);
assert.equal(
  canonicalDocumentReadiness.reviewReasons.includes(
    "PRIMARY_SOURCE_COVERAGE_REQUIRED",
  ),
  false,
);

const verifiedPrimary = source("source-primary", {
  adapterId: "primary",
  mediaKind: "document",
  sourceMetadata: {
    provenanceVerified: true,
    provenanceKind: "direct_transcript",
  },
});
const verifiedClassification = classifyResearchSourceDirectness(verifiedPrimary);
assert.equal(verifiedClassification.directness, "primary");
const covered = createResearchTopicReadiness({
  graph: graphForClaimType("FACT", verifiedPrimary),
  sourceAssessments: [{
    sourceId: verifiedPrimary.sourceId,
    directness: verifiedClassification.directness,
    provenanceStatus: "complete",
    reviewStatus: "usable",
    reviewReasons: [],
  }],
});
assert.deepEqual(covered.primarySourceCoveredClaimIds, ["claim-equivalent"]);
assert.equal(covered.reviewReasons.includes("PRIMARY_SOURCE_COVERAGE_REQUIRED"), false);

const primaryIntentOnly = source("source-primary-intent", { adapterId: "primary" });
const primaryIntentClassification = classifyResearchSourceDirectness(primaryIntentOnly);
assert.equal(primaryIntentClassification.directness, "secondary");
const intentNotCovered = createResearchTopicReadiness({
  graph: graphForClaimType("FACT", primaryIntentOnly),
  sourceAssessments: [{
    sourceId: primaryIntentOnly.sourceId,
    directness: primaryIntentClassification.directness,
    provenanceStatus: "complete",
    reviewStatus: "usable",
    reviewReasons: [],
  }],
});
assert.deepEqual(intentNotCovered.primarySourceCoveredClaimIds, []);
assert.ok(intentNotCovered.reviewReasons.includes("PRIMARY_SOURCE_COVERAGE_REQUIRED"));

const secondSource = source("source-2", {
  summary: "A separate grounded observation establishes a distinct result.",
});
const base = graphForClaimType("FACT");
const mutatedRepair = createResearchClaimEvidenceGraph({
  sources: [contractSource, secondSource],
  claims: [
    {
      ...base.claims[0],
      origin: { ...attributedOrigin, attributedEntity: "Changed Entity" },
    },
    {
      claimId: "claim-added",
      claimType: "FACT",
      text: "A separate grounded result exists.",
      propositionKind: "world_state",
      origin: emptyOrigin,
    },
  ],
  evidence: [
    ...base.evidence,
    {
      evidenceId: "evidence-added",
      sourceId: secondSource.sourceId,
      excerpt: secondSource.summary,
      contextNote: null,
      locator,
    },
  ],
  links: [
    ...base.links,
    { claimId: "claim-added", evidenceId: "evidence-added", stance: "supports" },
  ],
});
const repairResult = await repairCollapsedCanonicalEditorialSelection({
  candidateSpans: [
    { spanId: "span-1", sourceId: contractSource.sourceId, text: contractSource.summary, evidenceSpecificity: "abstract_or_conceptual" },
    { spanId: "span-2", sourceId: secondSource.sourceId, text: secondSource.summary, evidenceSpecificity: "abstract_or_conceptual" },
  ],
  graph: base,
  sourceResearchPurposes: {},
  requestRepair: async () => ({
    repairOutcome: "additions_found",
    capabilityResolutions: [],
    canonicalGraph: mutatedRepair,
  }),
  validateRepair: async (proposal) => proposal,
});
assert.equal(repairResult.diagnostic.repairAccepted, false);
assert.equal(repairResult.diagnostic.reasonCode, "repair_dropped_base");
assert.equal(repairResult.graph, base);

const route = await readFile(
  new URL("../app/api/creator-editorial-analysis/route.ts", import.meta.url),
  "utf8",
);
assert.equal(
  [...route.matchAll(/operationType: "creator_editorial_claim_origin_adjudication"/g)].length,
  1,
  "the route contains exactly one bounded proposition-origin adjudication call",
);
assert.match(route, /Do not rewrite, reinterpret, add, or remove claim ids, claim text, claimType, evidence, links, sources, or stance/);
assert.match(route, /EDITORIAL_CLAIM_ORIGIN_AMBIGUOUS/);
assert.match(route, /CREATOR_EDITORIAL_CLAIM_ORIGIN_DISAGREEMENT/);

console.log("Stage 0.18A6L canonical claim proposition authority: PASS");
