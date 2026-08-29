import type {
  ResearchClaimEvidenceGraph,
  ResearchClaimType,
} from "./claimEvidenceGraph.ts";
import type { ResearchSourceAssessment } from "./sourceAssessment.ts";

export type ResearchTopicReadinessStatus = "blocked" | "review" | "ready";

export type ResearchTopicReadinessReport = {
  version: "0.10H-2B";
  status: ResearchTopicReadinessStatus;
  editorialReadinessScore: number;
  claimCount: number;
  evidenceRequiredClaimCount: number;
  supportedClaimCount: number;
  unsupportedClaimIds: string[];
  primarySourceRequiredClaimIds: string[];
  primarySourceCoveredClaimIds: string[];
  counterEvidenceRecommendedClaimIds: string[];
  counterEvidenceCoveredClaimIds: string[];
  dimensions: {
    evidenceCoveragePct: number;
    sourceUsabilityPct: number;
    primarySourceCoveragePct: number;
    counterEvidenceCoveragePct: number;
    sourceDiversityCount: number;
  };
  reviewReasons: string[];
};

const EVIDENCE_OPTIONAL_CLAIM_TYPES = new Set<ResearchClaimType>([
  "THOUGHT_EXPERIMENT",
]);

const COUNTER_EVIDENCE_RECOMMENDED_TYPES = new Set<ResearchClaimType>([
  "THEORY",
  "FORECAST",
  "HYPOTHESIS",
  "METAPHYSICAL_CLAIM",
  "EDITORIAL_INFERENCE",
]);

function pct(covered: number, total: number) {
  if (total <= 0) return 100;
  return Math.round((covered / total) * 100);
}

function boundedScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Measures editorial research readiness, not truth.
 *
 * The score describes whether claims have traceable evidence, usable source
 * provenance, required primary-source coverage and material counter-evidence.
 * It deliberately does not rank ideologies, beliefs, opinions or sources by a
 * universal truth score.
 */
export function createResearchTopicReadiness(input: {
  graph: ResearchClaimEvidenceGraph;
  sourceAssessments: ResearchSourceAssessment[];
}): ResearchTopicReadinessReport {
  const { graph } = input;
  const assessmentBySourceId = new Map(
    input.sourceAssessments.map((assessment) => [assessment.sourceId, assessment]),
  );
  const evidenceById = new Map(
    graph.evidence.map((evidence) => [evidence.evidenceId, evidence]),
  );

  const supportEvidenceIdsByClaim = new Map<string, string[]>();
  const contradictionEvidenceIdsByClaim = new Map<string, string[]>();

  for (const link of graph.links) {
    const target = link.stance === "supports"
      ? supportEvidenceIdsByClaim
      : link.stance === "contradicts"
        ? contradictionEvidenceIdsByClaim
        : null;
    if (!target) continue;
    const current = target.get(link.claimId) || [];
    current.push(link.evidenceId);
    target.set(link.claimId, current);
  }

  const evidenceRequiredClaims = graph.claims.filter(
    (claim) => !EVIDENCE_OPTIONAL_CLAIM_TYPES.has(claim.claimType),
  );
  const supportedClaimIds = evidenceRequiredClaims
    .filter((claim) => (supportEvidenceIdsByClaim.get(claim.claimId) || []).length > 0)
    .map((claim) => claim.claimId);
  const supportedClaimIdSet = new Set(supportedClaimIds);
  const unsupportedClaimIds = evidenceRequiredClaims
    .filter((claim) => !supportedClaimIdSet.has(claim.claimId))
    .map((claim) => claim.claimId);

  const primarySourceRequiredClaimIds = graph.claims
    .filter((claim) => claim.claimType === "PRIMARY_SOURCE_CLAIM")
    .map((claim) => claim.claimId);
  const primarySourceCoveredClaimIds = primarySourceRequiredClaimIds.filter((claimId) =>
    (supportEvidenceIdsByClaim.get(claimId) || []).some((evidenceId) => {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence) return false;
      return assessmentBySourceId.get(evidence.sourceId)?.directness === "primary";
    }),
  );

  const counterEvidenceRecommendedClaimIds = graph.claims
    .filter((claim) => COUNTER_EVIDENCE_RECOMMENDED_TYPES.has(claim.claimType))
    .map((claim) => claim.claimId);
  const counterEvidenceCoveredClaimIds = counterEvidenceRecommendedClaimIds.filter(
    (claimId) => (contradictionEvidenceIdsByClaim.get(claimId) || []).length > 0,
  );

  const usedSourceIds = new Set<string>();
  for (const link of graph.links) {
    const evidence = evidenceById.get(link.evidenceId);
    if (evidence) usedSourceIds.add(evidence.sourceId);
  }
  const usableSourceCount = [...usedSourceIds].filter(
    (sourceId) => assessmentBySourceId.get(sourceId)?.reviewStatus === "usable",
  ).length;

  const evidenceCoveragePct = pct(
    supportedClaimIds.length,
    evidenceRequiredClaims.length,
  );
  const sourceUsabilityPct = pct(usableSourceCount, usedSourceIds.size);
  const primarySourceCoveragePct = pct(
    primarySourceCoveredClaimIds.length,
    primarySourceRequiredClaimIds.length,
  );
  const counterEvidenceCoveragePct = pct(
    counterEvidenceCoveredClaimIds.length,
    counterEvidenceRecommendedClaimIds.length,
  );

  const editorialReadinessScore = boundedScore(
    evidenceCoveragePct * 0.45 +
      sourceUsabilityPct * 0.2 +
      primarySourceCoveragePct * 0.15 +
      counterEvidenceCoveragePct * 0.2,
  );

  const reviewReasons: string[] = [];
  if (unsupportedClaimIds.length) {
    reviewReasons.push("CLAIMS_REQUIRE_TRACEABLE_EVIDENCE");
  }
  if (primarySourceCoveredClaimIds.length < primarySourceRequiredClaimIds.length) {
    reviewReasons.push("PRIMARY_SOURCE_COVERAGE_REQUIRED");
  }
  if (counterEvidenceCoveredClaimIds.length < counterEvidenceRecommendedClaimIds.length) {
    reviewReasons.push("MATERIAL_COUNTER_EVIDENCE_REVIEW");
  }
  if (sourceUsabilityPct < 100) {
    reviewReasons.push("SOURCE_PROVENANCE_REVIEW");
  }

  const blocked =
    unsupportedClaimIds.length > 0 ||
    primarySourceCoveredClaimIds.length < primarySourceRequiredClaimIds.length;
  const status: ResearchTopicReadinessStatus = blocked
    ? "blocked"
    : reviewReasons.length > 0 || editorialReadinessScore < 80
      ? "review"
      : "ready";

  return {
    version: "0.10H-2B",
    status,
    editorialReadinessScore,
    claimCount: graph.claims.length,
    evidenceRequiredClaimCount: evidenceRequiredClaims.length,
    supportedClaimCount: supportedClaimIds.length,
    unsupportedClaimIds,
    primarySourceRequiredClaimIds,
    primarySourceCoveredClaimIds,
    counterEvidenceRecommendedClaimIds,
    counterEvidenceCoveredClaimIds,
    dimensions: {
      evidenceCoveragePct,
      sourceUsabilityPct,
      primarySourceCoveragePct,
      counterEvidenceCoveragePct,
      sourceDiversityCount: usedSourceIds.size,
    },
    reviewReasons,
  };
}
