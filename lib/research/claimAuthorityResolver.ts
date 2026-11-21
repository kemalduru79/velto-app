import {
  createResearchClaimEvidenceGraph,
  researchClaimRequiresPrimarySource,
  type ResearchClaim,
  type ResearchClaimEvidenceGraph,
} from "./claimEvidenceGraph.ts";
import {
  researchSourceIsPrimaryForClaim,
  type ResearchSourceAssessment,
} from "./sourceAssessment.ts";
import type { ResearchSource } from "./sourceContract.ts";

export const CLAIM_AUTHORITY_STATUSES = [
  "SUPPORTED",
  "SUPPORTED_PRIMARY",
  "PRIMARY_REQUIRED_MISSING",
  "UNSUPPORTED",
] as const;

export type ClaimAuthorityStatus =
  (typeof CLAIM_AUTHORITY_STATUSES)[number];

export const CLAIM_AUTHORITY_REASONS = [
  "SUPPORTING_EVIDENCE_PRESENT",
  "GLOBAL_PRIMARY_SUPPORT",
  "CLAIM_RELATIVE_PRIMARY_SUPPORT",
  "PRIMARY_REQUIRED_NO_QUALIFYING_PRIMARY",
  "NO_SUPPORTING_EVIDENCE",
] as const;

export type ClaimAuthorityReason =
  (typeof CLAIM_AUTHORITY_REASONS)[number];

export type ClaimAuthorityResolution = {
  claimId: string;
  requiresPrimary: boolean;
  status: ClaimAuthorityStatus;
  supportingEvidenceIds: string[];
  qualifyingPrimaryEvidenceIds: string[];
  reasons: ClaimAuthorityReason[];
};

export type ClaimAuthorityReport = {
  version: "0.19C";
  claims: ClaimAuthorityResolution[];
};

const SOURCE_DIRECTNESS_VALUES = new Set([
  "primary",
  "secondary",
  "tertiary",
  "unknown",
]);

function compareIds(left: string, right: string) {
  return left === right ? 0 : left < right ? -1 : 1;
}

function validatedGraph(graph: ResearchClaimEvidenceGraph) {
  if (
    !graph ||
    typeof graph !== "object" ||
    graph.version !== "0.10H-1B" ||
    !Array.isArray(graph.sources) ||
    !Array.isArray(graph.claims) ||
    !Array.isArray(graph.evidence) ||
    !Array.isArray(graph.links)
  ) {
    throw new Error("CLAIM_AUTHORITY_GRAPH_INVALID");
  }

  for (const link of graph.links) {
    if (
      link.stance !== "supports" &&
      link.stance !== "contradicts" &&
      link.stance !== "contextualizes"
    ) {
      throw new Error(
        `CLAIM_AUTHORITY_LINK_STANCE_INVALID:${link.claimId}:${link.evidenceId}`,
      );
    }
  }

  return createResearchClaimEvidenceGraph({
    sources: graph.sources,
    claims: graph.claims,
    evidence: graph.evidence,
    links: graph.links,
  });
}

function sourceAssessmentMap(input: {
  graph: ResearchClaimEvidenceGraph;
  sourceAssessments: ResearchSourceAssessment[];
}) {
  if (!Array.isArray(input.sourceAssessments)) {
    throw new Error("CLAIM_AUTHORITY_SOURCE_ASSESSMENTS_INVALID");
  }

  const sourceIds = new Set(input.graph.sources.map((source) => source.sourceId));
  const assessments = new Map<string, ResearchSourceAssessment>();

  for (const assessment of input.sourceAssessments) {
    if (!assessment || typeof assessment.sourceId !== "string") {
      throw new Error("CLAIM_AUTHORITY_SOURCE_ASSESSMENT_INVALID");
    }
    if (!sourceIds.has(assessment.sourceId)) {
      throw new Error(
        `CLAIM_AUTHORITY_SOURCE_ASSESSMENT_ORPHAN:${assessment.sourceId}`,
      );
    }
    if (assessments.has(assessment.sourceId)) {
      throw new Error(
        `CLAIM_AUTHORITY_SOURCE_ASSESSMENT_DUPLICATE:${assessment.sourceId}`,
      );
    }
    if (!SOURCE_DIRECTNESS_VALUES.has(assessment.directness)) {
      throw new Error(
        `CLAIM_AUTHORITY_SOURCE_ASSESSMENT_DIRECTNESS_INVALID:${assessment.sourceId}`,
      );
    }
    assessments.set(assessment.sourceId, assessment);
  }

  return assessments;
}

/**
 * Canonical source qualification rule shared by graph authority resolution and
 * acquisition compatibility code. A missing assessment contributes no global
 * primary authority, but canonical claim-relative authority remains available.
 */
export function researchSourceQualifiesAsPrimaryForClaim(input: {
  source: ResearchSource;
  claim: ResearchClaim | null | undefined;
  sourceAssessment?: ResearchSourceAssessment | null;
}) {
  if (
    input.sourceAssessment &&
    input.sourceAssessment.sourceId !== input.source.sourceId
  ) {
    throw new Error(
      `CLAIM_AUTHORITY_SOURCE_ASSESSMENT_MISMATCH:${input.source.sourceId}`,
    );
  }

  return input.sourceAssessment?.directness === "primary" ||
    researchSourceIsPrimaryForClaim(input.source, input.claim);
}

/**
 * Resolves structural support and primary-source authority without applying
 * readiness, acquisition, exclusion, or script policy.
 *
 * Claims and evidence ids are explicitly sorted, so equivalent canonical input
 * produces byte-stable semantic output independent of input array ordering.
 * Missing assessments never invent global primary authority; the existing
 * conservative claim-relative source identity contract may still qualify them.
 */
export function resolveClaimAuthority(input: {
  graph: ResearchClaimEvidenceGraph;
  sourceAssessments: ResearchSourceAssessment[];
}): ClaimAuthorityReport {
  const graph = validatedGraph(input.graph);
  const assessmentBySourceId = sourceAssessmentMap({
    graph,
    sourceAssessments: input.sourceAssessments,
  });
  const evidenceById = new Map(
    graph.evidence.map((evidence) => [evidence.evidenceId, evidence]),
  );
  const sourceById = new Map(
    graph.sources.map((source) => [source.sourceId, source]),
  );
  const supportEvidenceIdsByClaim = new Map<string, Set<string>>();

  for (const link of graph.links) {
    if (link.stance !== "supports") continue;
    const evidenceIds = supportEvidenceIdsByClaim.get(link.claimId) ||
      new Set<string>();
    evidenceIds.add(link.evidenceId);
    supportEvidenceIdsByClaim.set(link.claimId, evidenceIds);
  }

  const claims = [...graph.claims]
    .sort((left, right) => compareIds(left.claimId, right.claimId))
    .map((claim): ClaimAuthorityResolution => {
      const supportingEvidenceIds = [
        ...(supportEvidenceIdsByClaim.get(claim.claimId) || []),
      ].sort(compareIds);
      const globallyPrimaryEvidenceIds = new Set<string>();
      const claimRelativePrimaryEvidenceIds = new Set<string>();

      for (const evidenceId of supportingEvidenceIds) {
        const evidence = evidenceById.get(evidenceId);
        if (!evidence) {
          throw new Error(
            `CLAIM_AUTHORITY_SUPPORTING_EVIDENCE_MISSING:${claim.claimId}:${evidenceId}`,
          );
        }
        const source = sourceById.get(evidence.sourceId);
        if (!source) {
          throw new Error(
            `CLAIM_AUTHORITY_SUPPORTING_SOURCE_MISSING:${claim.claimId}:${evidence.sourceId}`,
          );
        }
        const assessment = assessmentBySourceId.get(source.sourceId);
        const qualifiesAsPrimary = researchSourceQualifiesAsPrimaryForClaim({
          source,
          claim,
          sourceAssessment: assessment,
        });
        if (!qualifiesAsPrimary) continue;

        if (assessment?.directness === "primary") {
          globallyPrimaryEvidenceIds.add(evidenceId);
        } else {
          claimRelativePrimaryEvidenceIds.add(evidenceId);
        }
      }

      const qualifyingPrimaryEvidenceIds = [
        ...globallyPrimaryEvidenceIds,
        ...claimRelativePrimaryEvidenceIds,
      ].sort(compareIds);
      const requiresPrimary = researchClaimRequiresPrimarySource(claim);
      const reasons: ClaimAuthorityReason[] = supportingEvidenceIds.length > 0
        ? ["SUPPORTING_EVIDENCE_PRESENT"]
        : ["NO_SUPPORTING_EVIDENCE"];
      if (globallyPrimaryEvidenceIds.size > 0) {
        reasons.push("GLOBAL_PRIMARY_SUPPORT");
      }
      if (claimRelativePrimaryEvidenceIds.size > 0) {
        reasons.push("CLAIM_RELATIVE_PRIMARY_SUPPORT");
      }
      if (requiresPrimary && qualifyingPrimaryEvidenceIds.length === 0) {
        reasons.push("PRIMARY_REQUIRED_NO_QUALIFYING_PRIMARY");
      }

      // Missing structural support takes precedence over an unmet primary
      // obligation. requiresPrimary and the reason codes retain both facts.
      const status: ClaimAuthorityStatus = supportingEvidenceIds.length === 0
        ? "UNSUPPORTED"
        : !requiresPrimary
          ? "SUPPORTED"
          : qualifyingPrimaryEvidenceIds.length > 0
            ? "SUPPORTED_PRIMARY"
            : "PRIMARY_REQUIRED_MISSING";

      return {
        claimId: claim.claimId,
        requiresPrimary,
        status,
        supportingEvidenceIds,
        qualifyingPrimaryEvidenceIds,
        reasons,
      };
    });

  return {
    version: "0.19C",
    claims,
  };
}
