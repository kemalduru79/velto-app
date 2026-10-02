import {
  createResearchClaimEvidenceGraph,
  type ResearchClaim,
  type ResearchClaimEvidenceGraph,
  type ResearchEvidence,
} from "./claimEvidenceGraph.ts";
import { researchSourceQualifiesAsPrimaryForClaim } from "./claimAuthorityResolver.ts";
import { createValidatedEditorialAnalysis } from "./editorialAnalysisContract.ts";
import {
  MAX_EDITORIAL_GROUNDING_SPANS_PER_REQUEST,
  type EditorialGroundingCandidateSpan,
} from "./editorialGroundingRepair.ts";
import { createEditorialEvidenceSpanCatalog } from "./editorialEvidenceSpanCatalog.ts";
import { normalizeEditorialAnalysisRequest } from "./editorialAnalysisRequest.ts";
import { canonicalResearchUrl } from "./orchestratedResearch.ts";
import {
  assessResearchSource,
  classifyResearchSourceDirectness,
  type ResearchSourceAssessment,
} from "./sourceAssessment.ts";
import type { ResearchSource } from "./sourceContract.ts";
import {
  createResearchTopicReadiness,
  type ResearchTopicReadinessReport,
} from "./topicEvidenceReadiness.ts";

export type EditorialPrimaryCoverageRepairSelection = {
  repairs: Array<{ claimId: string; spanId: string }>;
};

export type EditorialPrimaryCoverageRepairContext = {
  frozenGraph: ResearchClaimEvidenceGraph;
  frozenSourceAssessments: ResearchSourceAssessment[];
  initialReadiness: ResearchTopicReadinessReport;
  originalPrimaryRequiredClaimIds: string[];
  targetClaimIds: string[];
  candidatePrimarySources: ResearchSource[];
  candidateSpans: EditorialGroundingCandidateSpan[];
  creatorProfile: unknown;
};

export type EditorialPrimaryCoverageRepairResult = {
  graph: ResearchClaimEvidenceGraph;
  sourceAssessments: ResearchSourceAssessment[];
  readiness: ResearchTopicReadinessReport;
  repairedClaimIds: string[];
  unresolvedClaimIds: string[];
  excludedPrimaryClaimIds: string[];
};

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function normalizeSources(values: unknown, label: string) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`${label}_SOURCES_REQUIRED`);
  }
  try {
    return normalizeEditorialAnalysisRequest({
      topic: "Primary coverage augmentation",
      sources: values,
    }).sources;
  } catch (error) {
    const diagnostic = error instanceof Error ? error.message : "INVALID";
    throw new Error(`${label}_${diagnostic}`);
  }
}

function normalizeRequiredClaimIds(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 30) {
    throw new Error("EDITORIAL_PRIMARY_COVERAGE_REQUIRED_CLAIMS_INVALID");
  }
  const claimIds = value.map((item) => clean(item, 120));
  if (claimIds.some((claimId) => !claimId)) {
    throw new Error("EDITORIAL_PRIMARY_COVERAGE_REQUIRED_CLAIMS_INVALID");
  }
  if (new Set(claimIds).size !== claimIds.length) {
    throw new Error("EDITORIAL_PRIMARY_COVERAGE_REQUIRED_CLAIMS_DUPLICATE");
  }
  return claimIds;
}

function equalStringArrays(left: string[], right: string[]) {
  return left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function claimAuthority(claim: ResearchClaim) {
  return {
    claimId: claim.claimId,
    claimType: claim.claimType,
    text: claim.text,
    propositionKind: claim.propositionKind,
    origin: claim.origin,
  };
}

function assertFrozenClaimAuthority(input: {
  before: ResearchClaim[];
  after: ResearchClaim[];
}) {
  if (input.before.length !== input.after.length) {
    throw new Error("EDITORIAL_PRIMARY_COVERAGE_CLAIM_AUTHORITY_CHANGED");
  }
  input.before.forEach((claim, index) => {
    if (
      JSON.stringify(claimAuthority(claim)) !==
        JSON.stringify(claimAuthority(input.after[index]))
    ) {
      throw new Error(
        `EDITORIAL_PRIMARY_COVERAGE_CLAIM_AUTHORITY_CHANGED:${claim.claimId}`,
      );
    }
  });
}

function sourceIdentity(source: ResearchSource) {
  return JSON.stringify(source);
}

function deduplicateCandidateSources(input: {
  frozenSources: ResearchSource[];
  candidateSources: ResearchSource[];
  targetClaims: ResearchClaim[];
}) {
  const frozenById = new Map(
    input.frozenSources.map((source) => [source.sourceId, source]),
  );
  const selectedByCanonicalUrl = new Map<string, ResearchSource>();

  for (const candidate of input.candidateSources) {
    if (
      !input.targetClaims.some((claim) =>
        researchSourceQualifiesAsPrimaryForClaim({
          source: candidate,
          claim,
        })
      )
    ) {
      throw new Error(
        `EDITORIAL_PRIMARY_COVERAGE_SOURCE_NOT_PRIMARY:${candidate.sourceId}`,
      );
    }

    const frozen = frozenById.get(candidate.sourceId);
    if (frozen && sourceIdentity(frozen) !== sourceIdentity(candidate)) {
      throw new Error(
        `EDITORIAL_PRIMARY_COVERAGE_SOURCE_ID_CONFLICT:${candidate.sourceId}`,
      );
    }

    const canonicalUrl = canonicalResearchUrl(candidate.url);
    const key = canonicalUrl || candidate.sourceId;
    if (!selectedByCanonicalUrl.has(key)) {
      selectedByCanonicalUrl.set(key, frozen || candidate);
    }
  }

  return [...selectedByCanonicalUrl.values()];
}

function normalizeFrozenGraph(value: unknown) {
  const graph = record(value);
  if (!graph) throw new Error("EDITORIAL_PRIMARY_COVERAGE_GRAPH_REQUIRED");
  const sources = normalizeSources(
    graph.sources,
    "EDITORIAL_PRIMARY_COVERAGE_GRAPH",
  );
  return createValidatedEditorialAnalysis({
    sources,
    proposal: {
      claims: Array.isArray(graph.claims) ? graph.claims : [],
      evidence: Array.isArray(graph.evidence) ? graph.evidence : [],
      links: Array.isArray(graph.links) ? graph.links : [],
    },
    requirePropositionAuthority: true,
  });
}

/**
 * Validates the frozen first-pass graph and derives the repair target set on the
 * server. Client-supplied required ids are accepted only when they exactly match
 * the canonical readiness derived from that graph.
 */
export function createEditorialPrimaryCoverageRepairContext(
  value: unknown,
): EditorialPrimaryCoverageRepairContext {
  const body = record(value);
  if (!body) throw new Error("EDITORIAL_PRIMARY_COVERAGE_REQUEST_INVALID");

  const frozenGraph = normalizeFrozenGraph(body.frozenGraph);
  const frozenSourceAssessments = frozenGraph.sources.map((source) =>
    assessResearchSource(
      source,
      classifyResearchSourceDirectness(source).directness,
    ),
  );
  const initialReadiness = createResearchTopicReadiness({
    graph: frozenGraph,
    sourceAssessments: frozenSourceAssessments,
  });
  const originalPrimaryRequiredClaimIds = normalizeRequiredClaimIds(
    body.originalPrimaryRequiredClaimIds,
  );
  if (!equalStringArrays(
    originalPrimaryRequiredClaimIds,
    initialReadiness.primarySourceRequiredClaimIds,
  )) {
    throw new Error("EDITORIAL_PRIMARY_COVERAGE_REQUIRED_CLAIMS_MISMATCH");
  }

  const coveredClaimIds = new Set(
    initialReadiness.primarySourceCoveredClaimIds,
  );
  const targetClaimIds = originalPrimaryRequiredClaimIds.filter(
    (claimId) => !coveredClaimIds.has(claimId),
  );
  if (targetClaimIds.length === 0) {
    throw new Error("EDITORIAL_PRIMARY_COVERAGE_NO_REPAIR_REQUIRED");
  }

  const targetClaimIdSet = new Set(targetClaimIds);
  const targetClaims = frozenGraph.claims.filter((claim) =>
    targetClaimIdSet.has(claim.claimId)
  );

  const candidateSources =
    Array.isArray(body.candidateSources) &&
      body.candidateSources.length === 0
      ? []
      : normalizeSources(
          body.candidateSources,
          "EDITORIAL_PRIMARY_COVERAGE_CANDIDATE",
        );
  const candidatePrimarySources = deduplicateCandidateSources({
    frozenSources: frozenGraph.sources,
    candidateSources,
    targetClaims,
  });
  const candidateSpans = createEditorialEvidenceSpanCatalog(
    candidatePrimarySources,
  ).spans;
  // Zero candidate spans is a legitimate acquisition result. The route
  // will skip provider selection and invoke the server-owned safe-exclusion
  // path with an empty repair selection.
  if (candidateSpans.length > MAX_EDITORIAL_GROUNDING_SPANS_PER_REQUEST) {
    throw new Error("EDITORIAL_PRIMARY_COVERAGE_CANDIDATE_LIMIT_EXCEEDED");
  }

  return {
    frozenGraph,
    frozenSourceAssessments,
    initialReadiness,
    originalPrimaryRequiredClaimIds,
    targetClaimIds,
    candidatePrimarySources,
    candidateSpans,
    creatorProfile: body.creatorProfile ?? {},
  };
}

function parseRepairSelection(input: {
  value: unknown;
  targetClaimIds: string[];
  candidateSpans: EditorialGroundingCandidateSpan[];
}): EditorialPrimaryCoverageRepairSelection {
  const selection = record(input.value);
  if (!selection || Object.keys(selection).join(",") !== "repairs") {
    throw new Error("EDITORIAL_PRIMARY_COVERAGE_SELECTION_INVALID");
  }
  if (!Array.isArray(selection.repairs)) {
    throw new Error("EDITORIAL_PRIMARY_COVERAGE_SELECTION_INVALID");
  }
  if (selection.repairs.length > input.targetClaimIds.length) {
    throw new Error("EDITORIAL_PRIMARY_COVERAGE_SELECTION_LIMIT_EXCEEDED");
  }

  const targetClaimIds = new Set(input.targetClaimIds);
  const candidateSpanIds = new Set(
    input.candidateSpans.map((span) => span.spanId),
  );
  const selectedClaimIds = new Set<string>();

  const repairs = selection.repairs.map((value) => {
    const repair = record(value);
    if (
      !repair ||
      Object.keys(repair).sort().join(",") !== "claimId,spanId"
    ) {
      throw new Error("EDITORIAL_PRIMARY_COVERAGE_SELECTION_INVALID");
    }
    const claimId = clean(repair.claimId, 120);
    const spanId = clean(repair.spanId, 300);
    if (!targetClaimIds.has(claimId)) {
      throw new Error(
        `EDITORIAL_PRIMARY_COVERAGE_TARGET_NOT_ALLOWED:${claimId}`,
      );
    }
    if (!candidateSpanIds.has(spanId)) {
      throw new Error(
        `EDITORIAL_PRIMARY_COVERAGE_SPAN_NOT_ALLOWED:${spanId}`,
      );
    }
    if (selectedClaimIds.has(claimId)) {
      throw new Error(
        `EDITORIAL_PRIMARY_COVERAGE_TARGET_DUPLICATE:${claimId}`,
      );
    }
    selectedClaimIds.add(claimId);
    return { claimId, spanId };
  }).toSorted((left, right) =>
    left.claimId.localeCompare(right.claimId) ||
    left.spanId.localeCompare(right.spanId)
  );

  return { repairs };
}

function nextEvidenceId(existingEvidenceIds: Set<string>, ordinal: number) {
  let suffix = ordinal;
  let candidate = `primary-coverage-evidence-${suffix}`;
  while (existingEvidenceIds.has(candidate)) {
    suffix += 1;
    candidate = `primary-coverage-evidence-${suffix}`;
  }
  existingEvidenceIds.add(candidate);
  return candidate;
}

/**
 * Applies only allowlisted claim/span selections. Evidence prose and links are
 * reconstructed from canonical spans; no provider-authored graph is accepted.
 */
export function applyEditorialPrimaryCoverageRepair(input: {
  context: EditorialPrimaryCoverageRepairContext;
  selection: unknown;
}): EditorialPrimaryCoverageRepairResult {
  const selection = parseRepairSelection({
    value: input.selection,
    targetClaimIds: input.context.targetClaimIds,
    candidateSpans: input.context.candidateSpans,
  });
  const spanById = new Map(
    input.context.candidateSpans.map((span) => [span.spanId, span]),
  );
  const candidateSourceById = new Map(
    input.context.candidatePrimarySources.map((source) => [source.sourceId, source]),
  );
  const claimById = new Map(
    input.context.frozenGraph.claims.map((claim) => [claim.claimId, claim]),
  );
  const graphSources = [...input.context.frozenGraph.sources];
  const graphSourceById = new Map(
    graphSources.map((source) => [source.sourceId, source]),
  );
  const evidence = [...input.context.frozenGraph.evidence];
  const links = [...input.context.frozenGraph.links];
  const evidenceIds = new Set(evidence.map((item) => item.evidenceId));
  const evidenceBySourceAndExcerpt = new Map(
    evidence.map((item) => [`${item.sourceId}\0${item.excerpt || ""}`, item]),
  );
  const existingLinkByClaimAndEvidence = new Map(
    links.map((link) => [`${link.claimId}\0${link.evidenceId}`, link]),
  );
  const repairedClaimIds: string[] = [];
  let evidenceOrdinal = 1;

  for (const repair of selection.repairs) {
    const span = spanById.get(repair.spanId)!;
    const candidateSource = candidateSourceById.get(span.sourceId);
    const targetClaim = claimById.get(repair.claimId);

    if (
      !candidateSource ||
      !targetClaim ||
      !researchSourceQualifiesAsPrimaryForClaim({
        source: candidateSource,
        claim: targetClaim,
      })
    ) {
      throw new Error(
        `EDITORIAL_PRIMARY_COVERAGE_SOURCE_NOT_PRIMARY:${span.sourceId}`,
      );
    }

    const existingSource = graphSourceById.get(candidateSource.sourceId);
    if (existingSource && sourceIdentity(existingSource) !== sourceIdentity(candidateSource)) {
      throw new Error(
        `EDITORIAL_PRIMARY_COVERAGE_SOURCE_ID_CONFLICT:${candidateSource.sourceId}`,
      );
    }
    if (!existingSource) {
      graphSources.push(candidateSource);
      graphSourceById.set(candidateSource.sourceId, candidateSource);
    }

    const evidenceIdentity = `${span.sourceId}\0${span.text}`;
    let evidenceItem = evidenceBySourceAndExcerpt.get(evidenceIdentity);
    if (!evidenceItem) {
      evidenceItem = {
        evidenceId: nextEvidenceId(evidenceIds, evidenceOrdinal),
        sourceId: span.sourceId,
        excerpt: span.text,
        contextNote: null,
        locator: {
          section: null,
          page: null,
          timecodeStartSec: null,
          timecodeEndSec: null,
        },
      } satisfies ResearchEvidence;
      evidenceOrdinal += 1;
      evidence.push(evidenceItem);
      evidenceBySourceAndExcerpt.set(evidenceIdentity, evidenceItem);
    }

    const linkIdentity = `${repair.claimId}\0${evidenceItem.evidenceId}`;
    const existingLink = existingLinkByClaimAndEvidence.get(linkIdentity);
    if (existingLink && existingLink.stance !== "supports") {
      throw new Error(
        `EDITORIAL_PRIMARY_COVERAGE_LINK_CONFLICT:${repair.claimId}:${evidenceItem.evidenceId}`,
      );
    }
    if (!existingLink) {
      const link = {
        claimId: repair.claimId,
        evidenceId: evidenceItem.evidenceId,
        stance: "supports" as const,
      };
      links.push(link);
      existingLinkByClaimAndEvidence.set(linkIdentity, link);
    }
    repairedClaimIds.push(repair.claimId);
  }

  const graph = createResearchClaimEvidenceGraph({
    sources: graphSources,
    claims: input.context.frozenGraph.claims,
    evidence,
    links,
  });
  assertFrozenClaimAuthority({
    before: input.context.frozenGraph.claims,
    after: graph.claims,
  });
  const sourceAssessments = graph.sources.map((source) =>
    assessResearchSource(
      source,
      classifyResearchSourceDirectness(source).directness,
    ),
  );
  const augmentedReadiness = createResearchTopicReadiness({
    graph,
    sourceAssessments,
  });

  if (!equalStringArrays(
    input.context.originalPrimaryRequiredClaimIds,
    augmentedReadiness.primarySourceRequiredClaimIds,
  )) {
    throw new Error("EDITORIAL_PRIMARY_COVERAGE_REQUIRED_CLAIMS_CHANGED");
  }

  const coveredClaimIds = new Set(
    augmentedReadiness.primarySourceCoveredClaimIds,
  );
  const unresolvedClaimIds =
    input.context.originalPrimaryRequiredClaimIds.filter(
      (claimId) => !coveredClaimIds.has(claimId),
    );

  if (unresolvedClaimIds.length === 0) {
    return {
      graph,
      sourceAssessments,
      readiness: augmentedReadiness,
      repairedClaimIds,
      unresolvedClaimIds: [],
      excludedPrimaryClaimIds: [],
    };
  }

  // Safe degradation:
  // the frozen editorial graph above remains unchanged. We derive a separate
  // script-authority graph that omits only claims whose mandatory primary
  // authority could not be verified. Their links are removed as well, so the
  // Script Planner cannot silently use them.
  const excludedClaimIdSet = new Set(unresolvedClaimIds);
  const scriptSafeClaims = graph.claims.filter(
    (claim) => !excludedClaimIdSet.has(claim.claimId),
  );

  if (scriptSafeClaims.length === 0) {
    throw new Error("EDITORIAL_PRIMARY_COVERAGE_NO_SAFE_CLAIMS");
  }

  const scriptSafeGraph = createResearchClaimEvidenceGraph({
    sources: graph.sources,
    claims: scriptSafeClaims,
    evidence: graph.evidence,
    links: graph.links.filter(
      (link) => !excludedClaimIdSet.has(link.claimId),
    ),
  });

  const scriptSafeReadiness = createResearchTopicReadiness({
    graph: scriptSafeGraph,
    sourceAssessments,
  });

  if (
    scriptSafeReadiness.reviewReasons.includes(
      "PRIMARY_SOURCE_COVERAGE_REQUIRED",
    )
  ) {
    throw new Error("EDITORIAL_PRIMARY_COVERAGE_SAFE_GRAPH_INVALID");
  }

  return {
    graph: scriptSafeGraph,
    sourceAssessments,
    readiness: scriptSafeReadiness,
    repairedClaimIds,
    unresolvedClaimIds,
    excludedPrimaryClaimIds: unresolvedClaimIds,
  };
}
