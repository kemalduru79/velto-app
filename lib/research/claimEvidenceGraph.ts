import type { ResearchSource } from "./sourceContract.ts";

export const RESEARCH_CLAIM_TYPES = [
  "FACT",
  "PRIMARY_SOURCE_CLAIM",
  "RESEARCH_FINDING",
  "EXPERT_OPINION",
  "THEORY",
  "FORECAST",
  "HYPOTHESIS",
  "METAPHYSICAL_CLAIM",
  "EDITORIAL_INFERENCE",
  "THOUGHT_EXPERIMENT",
] as const;

export type ResearchClaimType = (typeof RESEARCH_CLAIM_TYPES)[number];

export type ResearchClaim = {
  claimId: string;
  claimType: ResearchClaimType;
  text: string;
};

export type ResearchEvidenceLocator = {
  section: string | null;
  page: number | null;
  timecodeStartSec: number | null;
  timecodeEndSec: number | null;
};

export type ResearchEvidence = {
  evidenceId: string;
  sourceId: string;
  excerpt: string | null;
  contextNote: string | null;
  locator: ResearchEvidenceLocator;
};

export type ClaimEvidenceStance =
  | "supports"
  | "contradicts"
  | "contextualizes";

export type ResearchClaimEvidenceLink = {
  claimId: string;
  evidenceId: string;
  stance: ClaimEvidenceStance;
};

export type ResearchClaimEvidenceGraph = {
  version: "0.10H-1B";
  sources: ResearchSource[];
  claims: ResearchClaim[];
  evidence: ResearchEvidence[];
  links: ResearchClaimEvidenceLink[];
};

const CLAIM_TYPE_SET = new Set<string>(RESEARCH_CLAIM_TYPES);

export function isResearchClaimType(value: unknown): value is ResearchClaimType {
  return typeof value === "string" && CLAIM_TYPE_SET.has(value);
}

function assertUniqueIds(
  values: Array<{ id: string }>,
  label: string,
) {
  const seen = new Set<string>();

  for (const value of values) {
    if (!value.id.trim()) {
      throw new Error(`${label}_ID_REQUIRED`);
    }
    if (seen.has(value.id)) {
      throw new Error(`${label}_ID_DUPLICATE:${value.id}`);
    }
    seen.add(value.id);
  }

  return seen;
}

/**
 * Creates a lightweight, validated claim/evidence graph.
 *
 * This deliberately rejects dangling references or duplicate identifiers rather
 * than silently repairing editorial evidence. Source quality scoring, evidence
 * freezing and counterargument discovery are separate H-1 concerns.
 */
export function createResearchClaimEvidenceGraph(input: {
  sources: ResearchSource[];
  claims: ResearchClaim[];
  evidence: ResearchEvidence[];
  links: ResearchClaimEvidenceLink[];
}): ResearchClaimEvidenceGraph {
  const sourceIds = assertUniqueIds(
    input.sources.map((source) => ({ id: source.sourceId })),
    "SOURCE",
  );
  const claimIds = assertUniqueIds(
    input.claims.map((claim) => ({ id: claim.claimId })),
    "CLAIM",
  );
  const evidenceIds = assertUniqueIds(
    input.evidence.map((item) => ({ id: item.evidenceId })),
    "EVIDENCE",
  );

  for (const claim of input.claims) {
    if (!isResearchClaimType(claim.claimType)) {
      throw new Error(`CLAIM_TYPE_INVALID:${claim.claimId}`);
    }
    if (!claim.text.trim()) {
      throw new Error(`CLAIM_TEXT_REQUIRED:${claim.claimId}`);
    }
  }

  for (const item of input.evidence) {
    if (!sourceIds.has(item.sourceId)) {
      throw new Error(`EVIDENCE_SOURCE_MISSING:${item.evidenceId}`);
    }
  }

  const linkKeys = new Set<string>();
  for (const link of input.links) {
    if (!claimIds.has(link.claimId)) {
      throw new Error(`LINK_CLAIM_MISSING:${link.claimId}`);
    }
    if (!evidenceIds.has(link.evidenceId)) {
      throw new Error(`LINK_EVIDENCE_MISSING:${link.evidenceId}`);
    }

    const key = `${link.claimId}:${link.evidenceId}:${link.stance}`;
    if (linkKeys.has(key)) {
      throw new Error(`LINK_DUPLICATE:${key}`);
    }
    linkKeys.add(key);
  }

  return {
    version: "0.10H-1B",
    sources: [...input.sources],
    claims: [...input.claims],
    evidence: [...input.evidence],
    links: [...input.links],
  };
}
