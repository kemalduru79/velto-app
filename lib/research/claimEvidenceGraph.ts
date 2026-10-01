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

export const RESEARCH_PROPOSITION_KINDS = [
  "world_state",
  "attributed_statement",
  "document_assertion",
  "original_research_result",
  "expert_synthesis",
  "editorial_inference",
  "ambiguous",
] as const;

export type ResearchPropositionKind =
  (typeof RESEARCH_PROPOSITION_KINDS)[number];

export type ResearchClaimOrigin = {
  attributedEntity: string | null;
  referencedWork: string | null;
};

export type ResearchClaim = {
  claimId: string;
  claimType: ResearchClaimType;
  text: string;
  /** Absent only on persisted graphs created before proposition authority. */
  propositionKind?: ResearchPropositionKind;
  /** Absent only on persisted graphs created before proposition authority. */
  origin?: ResearchClaimOrigin;
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
const PROPOSITION_KIND_SET = new Set<string>(RESEARCH_PROPOSITION_KINDS);
const PRIMARY_SOURCE_PROPOSITION_KINDS = new Set<ResearchPropositionKind>([
  "attributed_statement",
  "document_assertion",
  "original_research_result",
]);

export function isResearchClaimType(value: unknown): value is ResearchClaimType {
  return typeof value === "string" && CLAIM_TYPE_SET.has(value);
}

export function isResearchPropositionKind(
  value: unknown,
): value is ResearchPropositionKind {
  return typeof value === "string" && PROPOSITION_KIND_SET.has(value);
}

function hasText(value: unknown) {
  return typeof value === "string" && Boolean(value.trim());
}

export function hasCanonicalPropositionAuthority(
  claim: Pick<ResearchClaim, "propositionKind" | "origin">,
) {
  return isResearchPropositionKind(claim.propositionKind) && Boolean(claim.origin);
}

export function validateResearchClaimPropositionAuthority(
  claim: Pick<ResearchClaim, "claimId" | "claimType" | "propositionKind" | "origin">,
  options: {
    required?: boolean;
    allowAmbiguous?: boolean;
    provisional?: boolean;
  } = {},
) {
  const hasKind = claim.propositionKind !== undefined;
  const hasOrigin = claim.origin !== undefined;
  if (!hasKind && !hasOrigin) {
    if (options.required) {
      throw new Error(`CLAIM_PROPOSITION_AUTHORITY_REQUIRED:${claim.claimId}`);
    }
    return;
  }
  if (!hasKind || !hasOrigin || !isResearchPropositionKind(claim.propositionKind)) {
    throw new Error(`CLAIM_PROPOSITION_AUTHORITY_INVALID:${claim.claimId}`);
  }
  if (
    !claim.origin ||
    typeof claim.origin !== "object" ||
    Array.isArray(claim.origin) ||
    !Object.hasOwn(claim.origin, "attributedEntity") ||
    !Object.hasOwn(claim.origin, "referencedWork") ||
    (claim.origin.attributedEntity !== null &&
      typeof claim.origin.attributedEntity !== "string") ||
    (claim.origin.referencedWork !== null &&
      typeof claim.origin.referencedWork !== "string")
  ) {
    throw new Error(`CLAIM_ORIGIN_INVALID:${claim.claimId}`);
  }

  if (options.provisional === true) {
    if (claim.propositionKind === "ambiguous" && !options.allowAmbiguous) {
      throw new Error(`EDITORIAL_CLAIM_ORIGIN_AMBIGUOUS:${claim.claimId}`);
    }
    return;
  }

  const attributedEntity = claim.origin.attributedEntity;
  const referencedWork = claim.origin.referencedWork;
  if (
    claim.propositionKind === "attributed_statement" &&
    !hasText(attributedEntity)
  ) {
    throw new Error(`CLAIM_ATTRIBUTED_ENTITY_REQUIRED:${claim.claimId}`);
  }
  if (
    (claim.propositionKind === "document_assertion" ||
      claim.propositionKind === "original_research_result") &&
    !hasText(referencedWork)
  ) {
    throw new Error(`CLAIM_REFERENCED_WORK_REQUIRED:${claim.claimId}`);
  }
  if (
    claim.propositionKind === "world_state" &&
    (hasText(attributedEntity) || hasText(referencedWork))
  ) {
    throw new Error(`CLAIM_WORLD_STATE_ORIGIN_INVALID:${claim.claimId}`);
  }
  if (
    claim.claimType === "PRIMARY_SOURCE_CLAIM" &&
    claim.propositionKind === "world_state"
  ) {
    throw new Error(`CLAIM_PRIMARY_SOURCE_WORLD_STATE_INVALID:${claim.claimId}`);
  }
  if (claim.propositionKind === "ambiguous" && !options.allowAmbiguous) {
    throw new Error(`EDITORIAL_CLAIM_ORIGIN_AMBIGUOUS:${claim.claimId}`);
  }
}

/**
 * Canonical primary-source obligation authority.
 *
 * The claim-type fallback applies only to persisted legacy claims that contain
 * no proposition authority at all. Partially present or malformed authority is
 * rejected by validation and never reaches this helper as a legacy claim.
 */
export function researchClaimRequiresPrimarySource(
  claim: Pick<ResearchClaim, "claimType" | "propositionKind" | "origin">,
) {
  if (hasCanonicalPropositionAuthority(claim)) {
    return PRIMARY_SOURCE_PROPOSITION_KINDS.has(claim.propositionKind!);
  }
  return claim.claimType === "PRIMARY_SOURCE_CLAIM";
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
}, options: {
  allowAmbiguousPropositionAuthority?: boolean;
  provisionalPropositionAuthority?: boolean;
} = {}): ResearchClaimEvidenceGraph {
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
    validateResearchClaimPropositionAuthority(claim, {
      allowAmbiguous: options.allowAmbiguousPropositionAuthority === true,
      provisional: options.provisionalPropositionAuthority === true,
    });
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
