import { createHash } from "node:crypto";
import { canonicalResearchUrl } from "./orchestratedResearch.ts";
import type { ResearchSource } from "./sourceContract.ts";
import type { ResearchClaim, ResearchEvidence } from "./claimEvidenceGraph.ts";

export const ORIGINAL_SOURCE_EVIDENCE_STATES = [
  "provider_extracted",
  "source_verified",
  "requires_review",
  "rejected",
] as const;

export type OriginalSourceEvidenceState = typeof ORIGINAL_SOURCE_EVIDENCE_STATES[number];

export type OriginalSourceDocument = {
  sourceId: string;
  url: string;
  content: string;
  acquisition: "trusted_fixture" | "trusted_fetch" | "human_review_required";
  expectedSha256?: string;
};

export type OriginalSourceEvidenceResult = {
  state: OriginalSourceEvidenceState;
  sourceId: string;
  sourceUrl: string;
  passage: string;
  passageDigest: string;
  sourceDocumentFingerprint: string | null;
  locator: { start: number; end: number; unit: "utf16_code_unit" } | null;
  reason: string;
};

export type OriginalSourceClaimAuthorityResult = {
  claimId: string;
  status: "accepted" | "requires_review" | "rejected";
  reason: string;
};

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const compact = (value: string) => value.replace(/\s+/gu, " ").trim();

export function verifyOriginalSourceEvidence(input: {
  source: ResearchSource;
  passage: string;
  document?: OriginalSourceDocument | null;
}): OriginalSourceEvidenceResult {
  const passage = compact(input.passage);
  const base = {
    sourceId: input.source.sourceId,
    sourceUrl: canonicalResearchUrl(input.source.url),
    passage,
    passageDigest: digest(passage),
  };
  if (passage.length < 24) return { ...base, state: "rejected", sourceDocumentFingerprint: null, locator: null, reason: "PASSAGE_TOO_SHORT" };
  if (!input.document) return { ...base, state: "provider_extracted", sourceDocumentFingerprint: null, locator: null, reason: "ORIGINAL_SOURCE_DOCUMENT_UNAVAILABLE" };
  const documentFingerprint = digest(input.document.content);
  if (input.document.sourceId !== input.source.sourceId || canonicalResearchUrl(input.document.url) !== base.sourceUrl) return { ...base, state: "rejected", sourceDocumentFingerprint: documentFingerprint, locator: null, reason: "SOURCE_IDENTITY_MISMATCH" };
  if (input.document.expectedSha256 && input.document.expectedSha256 !== documentFingerprint) return { ...base, state: "rejected", sourceDocumentFingerprint: documentFingerprint, locator: null, reason: "SOURCE_DOCUMENT_FINGERPRINT_MISMATCH" };
  const exactStart = input.document.content.indexOf(passage);
  if (exactStart < 0) {
    const normalizedMatch = compact(input.document.content).includes(passage);
    return { ...base, state: normalizedMatch ? "requires_review" : "rejected", sourceDocumentFingerprint: documentFingerprint, locator: null, reason: normalizedMatch ? "PASSAGE_REQUIRES_NORMALIZED_MATCH_REVIEW" : "PASSAGE_NOT_FOUND" };
  }
  const locator = { start: exactStart, end: exactStart + passage.length, unit: "utf16_code_unit" as const };
  if (input.document.acquisition === "human_review_required") return { ...base, state: "requires_review", sourceDocumentFingerprint: documentFingerprint, locator, reason: "DOCUMENT_ACQUISITION_REQUIRES_REVIEW" };
  return { ...base, state: "source_verified", sourceDocumentFingerprint: documentFingerprint, locator, reason: "ORIGINAL_SOURCE_EXACT_MATCH" };
}

export function assessOriginalSourceClaimAuthority(input: {
  claim: ResearchClaim & { supportingEvidenceIds: string[] };
  evidence: ResearchEvidence[];
  sources: ResearchSource[];
  fidelity: OriginalSourceEvidenceResult[];
  semanticAssessment: { status: "supported" | "unsupported" | "contradicted"; evidenceIds: string[] };
}): OriginalSourceClaimAuthorityResult {
  const evidenceIds = input.evidence.map((item) => item.evidenceId);
  if (new Set(evidenceIds).size !== evidenceIds.length || new Set(input.claim.supportingEvidenceIds).size !== input.claim.supportingEvidenceIds.length) return { claimId: input.claim.claimId, status: "rejected", reason: "EVIDENCE_ID_DUPLICATE" };
  if (!input.claim.supportingEvidenceIds.length || input.claim.supportingEvidenceIds.some((id) => !evidenceIds.includes(id))) return { claimId: input.claim.claimId, status: "rejected", reason: "SUPPORTING_EVIDENCE_MISSING" };
  if (input.semanticAssessment.status !== "supported" || input.semanticAssessment.evidenceIds.some((id) => !input.claim.supportingEvidenceIds.includes(id))) return { claimId: input.claim.claimId, status: "rejected", reason: input.semanticAssessment.status === "contradicted" ? "CLAIM_CONTRADICTED" : "CLAIM_NOT_SUBSTANTIVELY_SUPPORTED" };
  const supporting = input.evidence.filter((item) => input.claim.supportingEvidenceIds.includes(item.evidenceId));
  const fidelityBySource = new Map(input.fidelity.map((item) => [item.sourceId, item]));
  if (supporting.some((item) => !input.sources.some((source) => source.sourceId === item.sourceId))) return { claimId: input.claim.claimId, status: "rejected", reason: "SOURCE_PROVENANCE_MISSING" };
  const fidelityStates = supporting.map((item) => fidelityBySource.get(item.sourceId)?.state || "provider_extracted");
  if (fidelityStates.includes("rejected")) return { claimId: input.claim.claimId, status: "rejected", reason: "ORIGINAL_SOURCE_EVIDENCE_REJECTED" };
  if (fidelityStates.some((state) => state !== "source_verified")) return { claimId: input.claim.claimId, status: "requires_review", reason: "ORIGINAL_SOURCE_REVIEW_REQUIRED" };
  if (input.claim.propositionKind === "original_research_result") {
    const supportingSources = supporting.map((item) => input.sources.find((source) => source.sourceId === item.sourceId)!);
    const hasVerifiedOriginalResearch = supportingSources.some((source) => source.sourceMetadata.provenanceVerified === true && source.sourceMetadata.provenanceKind === "original_academic_paper");
    if (!hasVerifiedOriginalResearch) return { claimId: input.claim.claimId, status: "rejected", reason: "ORIGINAL_RESEARCH_PROVENANCE_REQUIRED" };
  }
  return { claimId: input.claim.claimId, status: "accepted", reason: "TRACEABLE_SOURCE_AND_SEMANTIC_SUPPORT" };
}
