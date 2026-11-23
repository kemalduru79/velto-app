import { createHash } from "node:crypto";
import { researchClaimRequiresPrimarySource } from "./claimEvidenceGraph.ts";
import type { ScriptPlannerEditorialContext } from "./scriptPlannerEditorialContext.ts";

// These digests identify exact normalized values; they are not signatures and
// have authority only when read from a server-owned verification record.
const canonical = (value: unknown): unknown => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).filter(([, item]) => item !== undefined).map(([key, item]) => [key, canonical(item)]))
    : value;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
export const sourceAuthoritySnapshotDigest = (context: ScriptPlannerEditorialContext) => digest(context);
export const sourceAuthoritySourceDigest = (source: ScriptPlannerEditorialContext["sources"][number]) => digest(source);
export const sourceAuthorityPassageDigest = (evidence: ScriptPlannerEditorialContext["evidence"][number]) => digest(evidence);
export const sourceAuthorityGraphDigest = (original: unknown, initial: unknown) => digest([original, initial]);

export function validateOwnedSourceSnapshot(input: {
  ownerUserId: string;
  projectId: string;
  context: ScriptPlannerEditorialContext;
  snapshot: { owner_user_id: string; project_id: string; snapshot_digest: string; editorial_context: unknown } | null;
}) {
  const row = input.snapshot;
  const expected = sourceAuthoritySnapshotDigest(input.context);
  return Boolean(row && row.owner_user_id === input.ownerUserId && row.project_id === input.projectId && row.snapshot_digest === expected && digest(row.editorial_context) === expected);
}

export type SourceAuthorityRecord = {
  owner_user_id: string;
  project_id: string;
  snapshot_digest: string;
  source_id: string;
  claim_id: string;
  evidence_id: string;
  source_digest: string;
  passage_digest: string;
  passage_verification: string;
  authority_classification: string;
  expires_at: string;
  claim_evidence_disposition?: string;
  disposition_rationale?: string;
  reviewer_user_id?: string;
  document_digest?: string;
  reviewer_authorization?: string;
  qualification_method?: string;
};

export function validateSourceAuthorityRecords(input: {
  ownerUserId: string;
  projectId: string;
  context: ScriptPlannerEditorialContext;
  records: SourceAuthorityRecord[];
  now?: number;
}) {
  const fail = (reason: string) => ({ ok: false as const, reason });
  if (!input.ownerUserId || !input.projectId || !input.context.evidence.length) return fail("SOURCE_AUTHORITY_RECORD_REQUIRED");
  const snapshot = sourceAuthoritySnapshotDigest(input.context);
  const now = input.now ?? Date.now();
  const recordsByEvidence = new Map<string, SourceAuthorityRecord>();
  const linkedEvidence = new Set(input.context.claims.flatMap((claim) => [...claim.supportingEvidenceIds, ...claim.counterEvidenceIds, ...claim.contextualEvidenceIds]));
  if (input.context.evidence.some((item) => !linkedEvidence.has(item.evidenceId))) return fail("SOURCE_AUTHORITY_UNLINKED_EVIDENCE");
  for (const record of input.records) {
    if (record.owner_user_id !== input.ownerUserId || record.project_id !== input.projectId || record.snapshot_digest !== snapshot) return fail("SOURCE_AUTHORITY_SCOPE_MISMATCH");
    const key = JSON.stringify([record.claim_id, record.evidence_id]);
    if (recordsByEvidence.has(key)) return fail("SOURCE_AUTHORITY_DUPLICATE");
    recordsByEvidence.set(key, record);
  }
  for (const claim of input.context.claims) for (const evidenceId of [...claim.supportingEvidenceIds, ...claim.counterEvidenceIds, ...claim.contextualEvidenceIds]) {
    const evidence = input.context.evidence.find((item) => item.evidenceId === evidenceId);
    if (!evidence) return fail("SOURCE_AUTHORITY_BINDING_MISMATCH");
    const source = input.context.sources.find((item) => item.sourceId === evidence.sourceId);
    const record = recordsByEvidence.get(JSON.stringify([claim.claimId, evidence.evidenceId]));
    if (!source || !record || record.source_id !== source.sourceId || record.source_digest !== sourceAuthoritySourceDigest(source) || record.passage_digest !== sourceAuthorityPassageDigest(evidence)) return fail("SOURCE_AUTHORITY_BINDING_MISMATCH");
    if (record.passage_verification !== "exact_source_match" || !Number.isFinite(Date.parse(record.expires_at)) || Date.parse(record.expires_at) <= now) return fail("SOURCE_PASSAGE_UNVERIFIED_OR_EXPIRED");
  }
  for (const claim of input.context.claims.filter(researchClaimRequiresPrimarySource)) {
    const permitted = claim.propositionKind === "original_research_result" ? ["original_research"] : ["original_research", "primary_document"];
    if (!claim.supportingEvidenceIds.some((id) => permitted.includes(recordsByEvidence.get(JSON.stringify([claim.claimId, id]))?.authority_classification ?? ""))) return fail("PRIMARY_SOURCE_AUTHORITY_UNVERIFIED");
  }
  return { ok: true as const };
}

/** Call only with rows loaded by the server, never client-supplied records. */
export function validatedDocumentedLimitations(input: Parameters<typeof validateSourceAuthorityRecords>[0]): string[] {
  if (!validateSourceAuthorityRecords(input).ok) return [];
  return input.context.claims.filter((claim) => claim.claimType === "EDITORIAL_INFERENCE" && claim.supportingEvidenceIds.some((evidenceId) => input.records.some((record) =>
    record.claim_id === claim.claimId && record.evidence_id === evidenceId &&
    record.claim_evidence_disposition === "documented_methodological_limitation" &&
    typeof record.disposition_rationale === "string" && record.disposition_rationale.trim().length >= 12 &&
    typeof record.reviewer_user_id === "string" && record.reviewer_user_id.length > 0 &&
    record.reviewer_authorization === "server_verified_reviewer_allowlist" &&
    record.qualification_method === "authorized_human_claim_review" &&
    typeof record.document_digest === "string" && /^[0-9a-f]{64}$/.test(record.document_digest)
  ))).map((claim) => claim.claimId);
}
