import {
  createResearchClaimEvidenceGraph,
  isResearchClaimType,
  type ClaimEvidenceStance,
  type ResearchClaimEvidenceGraph,
} from "./claimEvidenceGraph.ts";
import type { ResearchSource } from "./sourceContract.ts";

export type EditorialAnalysisProposal = {
  claims?: Array<{
    claimId?: unknown;
    claimType?: unknown;
    text?: unknown;
  }>;
  evidence?: Array<{
    evidenceId?: unknown;
    sourceId?: unknown;
    excerpt?: unknown;
    contextNote?: unknown;
  }>;
  links?: Array<{
    claimId?: unknown;
    evidenceId?: unknown;
    stance?: unknown;
  }>;
};

const MAX_ANALYSIS_CLAIMS = 80;
const MAX_ANALYSIS_EVIDENCE = 240;
const MAX_ANALYSIS_LINKS = 480;
const VALID_STANCES = new Set<ClaimEvidenceStance>([
  "supports",
  "contradicts",
  "contextualizes",
]);

function clean(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function normalizedForGrounding(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
}

function assertGroundedExcerpt(source: ResearchSource, excerpt: string) {
  if (!excerpt) return;
  const material = normalizedForGrounding(source.summary || "");
  const candidate = normalizedForGrounding(excerpt);
  if (!material || !candidate || !material.includes(candidate)) {
    throw new Error(`EDITORIAL_EVIDENCE_EXCERPT_NOT_GROUNDED:${source.sourceId}`);
  }
}

/**
 * Converts an editorial-analysis proposal into the canonical Claim-Evidence
 * Graph while enforcing source grounding. This is a validator/normalizer, not a
 * truth engine: it ensures the model only cites supplied research material and
 * preserves epistemic claim labels without deciding whether a worldview is true.
 */
export function createValidatedEditorialAnalysis(input: {
  sources: ResearchSource[];
  proposal: EditorialAnalysisProposal;
}): ResearchClaimEvidenceGraph {
  const rawClaims = Array.isArray(input.proposal.claims) ? input.proposal.claims : [];
  const rawEvidence = Array.isArray(input.proposal.evidence) ? input.proposal.evidence : [];
  const rawLinks = Array.isArray(input.proposal.links) ? input.proposal.links : [];

  if (rawClaims.length > MAX_ANALYSIS_CLAIMS) {
    throw new Error("EDITORIAL_ANALYSIS_TOO_MANY_CLAIMS");
  }
  if (rawEvidence.length > MAX_ANALYSIS_EVIDENCE) {
    throw new Error("EDITORIAL_ANALYSIS_TOO_MUCH_EVIDENCE");
  }
  if (rawLinks.length > MAX_ANALYSIS_LINKS) {
    throw new Error("EDITORIAL_ANALYSIS_TOO_MANY_LINKS");
  }

  const sourceById = new Map(input.sources.map((source) => [source.sourceId, source]));
  const claims = rawClaims.map((raw, index) => {
    const claimId = clean(raw.claimId, 120) || `claim-${index + 1}`;
    const text = clean(raw.text, 1_200);
    const claimType = clean(raw.claimType, 80);
    if (!text) throw new Error(`EDITORIAL_CLAIM_TEXT_REQUIRED:${claimId}`);
    if (!isResearchClaimType(claimType)) {
      throw new Error(`EDITORIAL_CLAIM_TYPE_INVALID:${claimId}`);
    }
    return { claimId, claimType, text };
  });

  const evidence = rawEvidence.map((raw, index) => {
    const evidenceId = clean(raw.evidenceId, 120) || `evidence-${index + 1}`;
    const sourceId = clean(raw.sourceId, 300);
    const source = sourceById.get(sourceId);
    if (!source) {
      throw new Error(`EDITORIAL_EVIDENCE_SOURCE_MISSING:${evidenceId}`);
    }
    const excerpt = clean(raw.excerpt, 2_500);
    assertGroundedExcerpt(source, excerpt);
    return {
      evidenceId,
      sourceId,
      excerpt: excerpt || null,
      contextNote: clean(raw.contextNote, 1_000) || null,
      locator: {
        section: null,
        page: null,
        timecodeStartSec: null,
        timecodeEndSec: null,
      },
    };
  });

  const links = rawLinks.map((raw) => {
    const claimId = clean(raw.claimId, 120);
    const evidenceId = clean(raw.evidenceId, 120);
    const stance = clean(raw.stance, 40) as ClaimEvidenceStance;
    if (!VALID_STANCES.has(stance)) {
      throw new Error(`EDITORIAL_EVIDENCE_STANCE_INVALID:${claimId}:${evidenceId}`);
    }
    return { claimId, evidenceId, stance };
  });

  return createResearchClaimEvidenceGraph({
    sources: [...input.sources],
    claims,
    evidence,
    links,
  });
}
