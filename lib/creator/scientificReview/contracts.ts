/** Stage 5E1F — offline-only agentic scientific pre-review contracts. */
export const SCIENTIFIC_REVIEW_VERSION = "stage-5e1f-offline-v1" as const;
export const REVIEW_ROLES = ["statistics", "benchmark", "modeling", "editorial"] as const;
export type ReviewerRole = (typeof REVIEW_ROLES)[number];
export const REVIEW_DECISIONS = [
  "PRELIMINARY_PASS", "REVISE", "BLOCK", "INSUFFICIENT_EVIDENCE",
] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/** No expert acceptance or production authorization exists in this schema. */
export type ScientificClaim = Readonly<{
  claimId: string;
  claimText: string;
  primaryRole: ReviewerRole;
  evidenceIds: readonly string[];
  scientificLimitations: readonly string[];
}>;
export type ScientificSource = Readonly<{
  sourceId: string;
  title: string;
  sourceVersion: string;
  documentSha256: string;
  mediaType: "text/plain" | "application/pdf";
  extractedTextSha256: string;
}>;
/** Byte offsets refer to UTF-8 text, not to pages or PDF binary. */
export type ScientificPassage = Readonly<{
  evidenceId: string;
  sourceId: string;
  passage: string;
  passageSha256: string;
  extractedStartByte: number;
  extractedEndByte: number;
  displayLocator: string;
}>;
export type ScientificReviewInput = Readonly<{
  version: typeof SCIENTIFIC_REVIEW_VERSION;
  runId: string;
  claims: readonly ScientificClaim[];
  sources: readonly ScientificSource[];
  evidence: readonly ScientificPassage[];
}>;
/** Local-only source bytes are never passed to the model. */
export type ScientificSourceMaterial = Readonly<{
  sourceId: string;
  documentBytes: Uint8Array;
  extractedText: string;
  /** PDF extraction is not independently page-verified by this MVP. */
}>;
export type VerifiedPassage = Readonly<ScientificPassage & {
  sourceVersion: string;
  sourceTitle: string;
  provenance: "utf8_document_exact_byte_match" | "pdf_extracted_text_unverified_locator";
}>;
export type ReviewerTask = Readonly<{
  version: typeof SCIENTIFIC_REVIEW_VERSION;
  runId: string;
  claimId: string;
  claimText: string;
  role: ReviewerRole;
  assessmentSide: "primary" | "adversarial";
  evidence: readonly VerifiedPassage[];
  scientificLimitations: readonly string[];
  /** No prior reviewer judgment is ever included here. */
}>;
export type ReviewerJudgment = Readonly<{
  claimId: string;
  role: ReviewerRole;
  decision: ReviewDecision;
  citedEvidenceIds: readonly string[];
  rationale: string;
  uncertainties: readonly string[];
  recommendedCorrections: readonly string[];
}>;
export type MockReviewer = Readonly<{
  kind: "offline_mock";
  review: (task: ReviewerTask) => Promise<unknown>;
}>;
export type CostPolicy = Readonly<{
  version: "stage-5e1f-mock-cost-v1";
  maximumCalls: number;
  maximumModeledUsd: number;
  reservedInputTokensPerCall: number;
  reservedOutputTokensPerCall: number;
  assumedInputUsdPerMillion: number;
  assumedOutputUsdPerMillion: number;
  safetyMultiplier: number;
}>;
export type ClaimAssessment = Readonly<{
  claimId: string;
  primary: ReviewerJudgment;
  adversarial: ReviewerJudgment;
  preliminaryDecision: ReviewDecision;
  disagreement: boolean;
  independence: "NOT_ESTABLISHED_OFFLINE_MOCK";
  evidenceLimitations: readonly string[];
}>;
export type ReviewReport = Readonly<{
  version: typeof SCIENTIFIC_REVIEW_VERSION;
  runId: string;
  mode: "OFFLINE_MOCK_ONLY";
  status: "PRELIMINARY_SIMULATION_NO_SCIENTIFIC_AUTHORITY";
  counts: Readonly<Record<ReviewDecision, number>>;
  claimCount: number;
  reviewCount: number;
  modeledReservedUsd: number;
  actualProviderSpendUsd: 0;
  assessments: readonly ClaimAssessment[];
  liveAuthorization: false;
  independentHumanApproval: false;
}>;

export function scientificReviewFail(reason: string): never {
  throw new Error(`STAGE_5E1F_${reason}`);
}
export function isSha256(v: unknown): v is string {
  return typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
}
export function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
export function nonEmptyString(v: unknown, max = 20000): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}
export function uniqueIds(items: readonly { [key: string]: unknown }[], key: string) {
  const found = new Set<string>();
  for (const item of items) {
    const id = item[key];
    if (!nonEmptyString(id, 150) || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(id)) {
      scientificReviewFail(`INVALID_${key.toUpperCase()}`);
    }
    if (found.has(id)) scientificReviewFail(`DUPLICATE_${key.toUpperCase()}`);
    found.add(id);
  }
  return found;
}

/** Reject unknown keys, especially attempts to smuggle human approvals or live-mode switches. */
export function exactKeys(value: unknown, keys: readonly string[], label: string): void {
  if (!isRecord(value)) scientificReviewFail(`${label}_NOT_OBJECT`);
  if (Object.keys(value).some((k) => !keys.includes(k)) || keys.some((k) => !(k in value))) {
    scientificReviewFail(`${label}_SCHEMA_INVALID`);
  }
}

export function validateJudgment(v: unknown, task: ReviewerTask): ReviewerJudgment {
  exactKeys(v, ["claimId", "role", "decision", "citedEvidenceIds", "rationale", "uncertainties", "recommendedCorrections"], "JUDGMENT");
  if (!isRecord(v)) scientificReviewFail("JUDGMENT_NOT_OBJECT");
  if (v.claimId !== task.claimId || v.role !== task.role || !REVIEW_DECISIONS.includes(v.decision as ReviewDecision)) {
    scientificReviewFail("JUDGMENT_AUTHORITY_INVALID");
  }
  if (!nonEmptyString(v.rationale) || !Array.isArray(v.citedEvidenceIds) ||
      !Array.isArray(v.uncertainties) || !Array.isArray(v.recommendedCorrections) ||
      !v.uncertainties.every((s: unknown) => nonEmptyString(s, 2000)) ||
      !v.recommendedCorrections.every((s: unknown) => nonEmptyString(s, 2000))) {
    scientificReviewFail("JUDGMENT_BODY_INVALID");
  }
  const availableIds = new Set(task.evidence.map((item) => item.evidenceId));
  const ids = v.citedEvidenceIds as unknown[];
  if (ids.length !== new Set(ids).size || ids.some((id) => !availableIds.has(id as string))) {
    scientificReviewFail("JUDGMENT_CITATIONS_INVALID");
  }
  if (v.decision === "PRELIMINARY_PASS" && (ids.length === 0 || ids.length !== availableIds.size)) {
    scientificReviewFail("PASS_REQUIRES_ALL_REFERENCED_EVIDENCE");
  }
  return structuredClone(v) as ReviewerJudgment;
}
