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
  authority: "original_research" | "primary_document" | "secondary_reporting" | "unknown";
  expectedSha256?: string;
};

export type OriginalSourceEvidenceResult = {
  state: OriginalSourceEvidenceState;
  evidenceId: string;
  sourceId: string;
  sourceUrl: string;
  passage: string;
  passageDigest: string;
  sourceDocumentFingerprint: string | null;
  locator: { start: number; end: number; unit: "utf16_code_unit" } | null;
  evidenceLocator: ResearchEvidence["locator"];
  documentAuthority: OriginalSourceDocument["authority"] | null;
  verificationBindingDigest: string;
  reason: string;
};

export type OriginalSourceClaimAuthorityResult = {
  claimId: string;
  status: "accepted" | "requires_review" | "rejected";
  reason: string;
};

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const compact = (value: string) => value.replace(/\s+/gu, " ").trim();
const locatorIdentity = (locator: ResearchEvidence["locator"]) => JSON.stringify([
  locator.section,
  locator.page,
  locator.timecodeStartSec,
  locator.timecodeEndSec,
]);
const verificationBindingDigest = (result: Omit<OriginalSourceEvidenceResult, "verificationBindingDigest">) => digest(JSON.stringify([
  result.state,
  result.evidenceId,
  result.sourceId,
  result.sourceUrl,
  result.passage,
  result.passageDigest,
  result.sourceDocumentFingerprint,
  result.locator,
  result.evidenceLocator,
  result.documentAuthority,
  result.reason,
]));

export function verifyOriginalSourceEvidence(input: {
  source: ResearchSource;
  evidence: ResearchEvidence;
  document?: OriginalSourceDocument | null;
}): OriginalSourceEvidenceResult {
  const seal = (result: Omit<OriginalSourceEvidenceResult, "verificationBindingDigest">): OriginalSourceEvidenceResult => ({
    ...result,
    verificationBindingDigest: verificationBindingDigest(result),
  });
  const passage = compact(input.evidence.excerpt || "");
  const base = {
    evidenceId: input.evidence.evidenceId,
    sourceId: input.source.sourceId,
    sourceUrl: canonicalResearchUrl(input.source.url),
    passage,
    passageDigest: digest(passage),
    evidenceLocator: { ...input.evidence.locator },
  };
  if (input.evidence.sourceId !== input.source.sourceId) return seal({ ...base, state: "rejected", sourceDocumentFingerprint: null, locator: null, documentAuthority: null, reason: "EVIDENCE_SOURCE_IDENTITY_MISMATCH" });
  if (passage.length < 24) return seal({ ...base, state: "rejected", sourceDocumentFingerprint: null, locator: null, documentAuthority: null, reason: "PASSAGE_TOO_SHORT" });
  if (!input.document) return seal({ ...base, state: "provider_extracted", sourceDocumentFingerprint: null, locator: null, documentAuthority: null, reason: "ORIGINAL_SOURCE_DOCUMENT_UNAVAILABLE" });
  const documentFingerprint = digest(input.document.content);
  if (input.document.sourceId !== input.source.sourceId || canonicalResearchUrl(input.document.url) !== base.sourceUrl) return seal({ ...base, state: "rejected", sourceDocumentFingerprint: documentFingerprint, locator: null, documentAuthority: input.document.authority, reason: "SOURCE_IDENTITY_MISMATCH" });
  if (input.document.expectedSha256 && input.document.expectedSha256 !== documentFingerprint) return seal({ ...base, state: "rejected", sourceDocumentFingerprint: documentFingerprint, locator: null, documentAuthority: input.document.authority, reason: "SOURCE_DOCUMENT_FINGERPRINT_MISMATCH" });
  const exactStart = input.document.content.indexOf(passage);
  if (exactStart < 0) {
    const normalizedMatch = compact(input.document.content).includes(passage);
    return seal({ ...base, state: normalizedMatch ? "requires_review" : "rejected", sourceDocumentFingerprint: documentFingerprint, locator: null, documentAuthority: input.document.authority, reason: normalizedMatch ? "PASSAGE_REQUIRES_NORMALIZED_MATCH_REVIEW" : "PASSAGE_NOT_FOUND" });
  }
  const locator = { start: exactStart, end: exactStart + passage.length, unit: "utf16_code_unit" as const };
  if (input.document.acquisition === "human_review_required") return seal({ ...base, state: "requires_review", sourceDocumentFingerprint: documentFingerprint, locator, documentAuthority: input.document.authority, reason: "DOCUMENT_ACQUISITION_REQUIRES_REVIEW" });
  return seal({ ...base, state: "source_verified", sourceDocumentFingerprint: documentFingerprint, locator, documentAuthority: input.document.authority, reason: "ORIGINAL_SOURCE_EXACT_MATCH" });
}

export function assessOriginalSourceClaimAuthority(input: {
  claim: ResearchClaim & { supportingEvidenceIds: string[] };
  evidence: ResearchEvidence[];
  sources: ResearchSource[];
  fidelity: OriginalSourceEvidenceResult[];
  semanticAssessment: { status: "supported" | "unsupported" | "contradicted"; evidenceIds: string[] };
}): OriginalSourceClaimAuthorityResult {
  const evidenceIds = input.evidence.map((item) => item.evidenceId);
  const fidelityEvidenceIds = input.fidelity.map((item) => item.evidenceId);
  const semanticEvidenceIds = input.semanticAssessment.evidenceIds;
  if (new Set(evidenceIds).size !== evidenceIds.length || new Set(input.claim.supportingEvidenceIds).size !== input.claim.supportingEvidenceIds.length || new Set(fidelityEvidenceIds).size !== fidelityEvidenceIds.length || new Set(semanticEvidenceIds).size !== semanticEvidenceIds.length) return { claimId: input.claim.claimId, status: "rejected", reason: "EVIDENCE_ID_DUPLICATE" };
  if (!input.claim.supportingEvidenceIds.length || input.claim.supportingEvidenceIds.some((id) => !evidenceIds.includes(id))) return { claimId: input.claim.claimId, status: "rejected", reason: "SUPPORTING_EVIDENCE_MISSING" };
  if (input.semanticAssessment.status !== "supported" || !semanticEvidenceIds.length || semanticEvidenceIds.some((id) => !input.claim.supportingEvidenceIds.includes(id)) || input.claim.supportingEvidenceIds.some((id) => !semanticEvidenceIds.includes(id))) return { claimId: input.claim.claimId, status: "rejected", reason: input.semanticAssessment.status === "contradicted" ? "CLAIM_CONTRADICTED" : "CLAIM_NOT_SUBSTANTIVELY_SUPPORTED" };
  const supporting = input.evidence.filter((item) => input.claim.supportingEvidenceIds.includes(item.evidenceId));
  const sourceById = new Map(input.sources.map((source) => [source.sourceId, source]));
  const fidelityByEvidenceId = new Map(input.fidelity.map((item) => [item.evidenceId, item]));
  if (supporting.some((item) => !input.sources.some((source) => source.sourceId === item.sourceId))) return { claimId: input.claim.claimId, status: "rejected", reason: "SOURCE_PROVENANCE_MISSING" };
  const bindingMismatch = supporting.some((item) => {
    const source = sourceById.get(item.sourceId);
    const fidelity = fidelityByEvidenceId.get(item.evidenceId);
    const passage = compact(item.excerpt || "");
    return !source || !fidelity || fidelity.verificationBindingDigest !== verificationBindingDigest(fidelity) || fidelity.sourceId !== item.sourceId || fidelity.sourceUrl !== canonicalResearchUrl(source.url) || fidelity.passage !== passage || fidelity.passageDigest !== digest(passage) || locatorIdentity(fidelity.evidenceLocator) !== locatorIdentity(item.locator) || (fidelity.state === "source_verified" && (fidelity.sourceDocumentFingerprint === null || fidelity.locator === null));
  });
  if (bindingMismatch) return { claimId: input.claim.claimId, status: "rejected", reason: "ORIGINAL_SOURCE_EVIDENCE_BINDING_INVALID" };
  const fidelityStates = supporting.map((item) => fidelityByEvidenceId.get(item.evidenceId)!.state);
  if (fidelityStates.includes("rejected")) return { claimId: input.claim.claimId, status: "rejected", reason: "ORIGINAL_SOURCE_EVIDENCE_REJECTED" };
  if (fidelityStates.some((state) => state !== "source_verified")) return { claimId: input.claim.claimId, status: "requires_review", reason: "ORIGINAL_SOURCE_REVIEW_REQUIRED" };
  if (input.claim.propositionKind === "original_research_result") {
    const hasVerifiedOriginalResearch = supporting.some((item) => fidelityByEvidenceId.get(item.evidenceId)?.documentAuthority === "original_research");
    if (!hasVerifiedOriginalResearch) return { claimId: input.claim.claimId, status: "rejected", reason: "ORIGINAL_RESEARCH_PROVENANCE_REQUIRED" };
  }
  return { claimId: input.claim.claimId, status: "accepted", reason: "TRACEABLE_SOURCE_AND_SEMANTIC_SUPPORT" };
}
