import { sourceAuthorityPassageDigest, sourceAuthoritySnapshotDigest, sourceAuthoritySourceDigest, validateSourceAuthorityRecords, type SourceAuthorityRecord } from './sourceAuthorityBoundary.ts';
import type { ScriptPlannerEditorialContext } from './scriptPlannerEditorialContext.ts';

/** Only call with server-loaded records for an already validated active graph. */
export function classifySourceAuthorityReview(input: { ownerUserId: string; projectId: string; context: ScriptPlannerEditorialContext; records: SourceAuthorityRecord[]; now?: number }) {
  const invalid = () => ({ status: 'AUTHORITY_INVALID' as const, requirements: [] });
  const digest = sourceAuthoritySnapshotDigest(input.context);
  const now = input.now ?? Date.now();
  if (!input.ownerUserId || !input.projectId || !input.context.evidence.length) return invalid();
  const expected = new Map<string, { claimId: string; evidenceId: string; sourceId: string }>();
  for (const claim of input.context.claims) {
    for (const evidenceId of [...claim.supportingEvidenceIds, ...claim.counterEvidenceIds, ...claim.contextualEvidenceIds]) {
      const evidence = input.context.evidence.find(item => item.evidenceId === evidenceId);
      if (!evidence || !input.context.sources.some(source => source.sourceId === evidence.sourceId)) return invalid();
      expected.set(JSON.stringify([claim.claimId, evidenceId]), { claimId: claim.claimId, evidenceId, sourceId: evidence.sourceId });
    }
  }
  if (input.context.evidence.some(item => ![...expected.values()].some(entry => entry.evidenceId === item.evidenceId))) return invalid();
  const seen = new Set<string>();
  for (const record of input.records) {
    const key = JSON.stringify([record.claim_id, record.evidence_id]);
    const pair = expected.get(key);
    const evidence = input.context.evidence.find(item => item.evidenceId === record.evidence_id);
    const source = input.context.sources.find(item => item.sourceId === record.source_id);
    if (!pair || seen.has(key) || !evidence || !source || pair.sourceId !== record.source_id || record.owner_user_id !== input.ownerUserId || record.project_id !== input.projectId || record.snapshot_digest !== digest || record.source_digest !== sourceAuthoritySourceDigest(source) || record.passage_digest !== sourceAuthorityPassageDigest(evidence) || record.passage_verification !== 'exact_source_match' || !['original_research','primary_document','secondary','unknown'].includes(record.authority_classification) || !Number.isFinite(Date.parse(record.expires_at)) || Date.parse(record.expires_at) <= now || !record.reviewer_user_id || record.reviewer_authorization !== 'server_verified_reviewer_allowlist' || record.qualification_method !== 'authorized_human_claim_review' || !/^[0-9a-f]{64}$/.test(record.document_digest || '')) return invalid();
    if (!['documented_methodological_limitation','independent_editorial_inference','insufficient_or_ambiguous_support'].includes(record.claim_evidence_disposition || '') || (record.claim_evidence_disposition !== 'insufficient_or_ambiguous_support' && (record.disposition_rationale || '').trim().length < 12)) return invalid();
    seen.add(key);
  }
  const missing = [...expected.entries()].filter(([key]) => !seen.has(key)).map(([, pair]) => pair);
  if (missing.length) return { status: 'REVIEW_REQUIRED' as const, requirements: missing };
  if (!validateSourceAuthorityRecords(input).ok) return invalid();
  return { status: 'REVIEW_COMPLETE' as const, requirements: [] };
}
