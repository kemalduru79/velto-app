import { NextResponse } from 'next/server';
import { enforceCreatorApiBoundary } from '@/lib/security/creatorApiBoundary';
import { loadServerAuthoritativeResearchGraph, loadServerPendingReviewResearchGraph } from '@/lib/research/sourceAuthorityWorkflow.server';
import { classifySourceAuthorityReview } from '@/lib/research/sourceAuthorityReviewStatus';
import { evaluateTrustedEvidence } from '@/lib/research/trustedEvidenceEvaluation';
import type { CounterEvidenceScopeDecision } from '@/lib/research/scriptPlannerEditorialContext';

/** Read-only. Snapshot identifiers select server records; they grant no authority. */
export async function POST(request: Request) {
  if (process.env.VELTO_SOURCE_AUTHORITY_ENABLED !== 'true') return NextResponse.json({ success:false, code:'SOURCE_AUTHORITY_DISABLED' }, { status:404 });
  const secured = await enforceCreatorApiBoundary<Record<string, unknown>>(request, 'creator-editorial-analysis');
  if (!secured.ok) return secured.response;
  const body = secured.context.body;
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const snapshotDigest = typeof body.snapshotDigest === 'string' ? body.snapshotDigest : '';
  if (!projectId || projectId.length > 200 || !/^[0-9a-f]{64}$/.test(snapshotDigest)) return NextResponse.json({ success:false, code:'EVIDENCE_EVALUATION_INPUT_INVALID' }, { status:400 });
  if (body.operation === 'review_status') {
    try {
      const active = await loadServerPendingReviewResearchGraph(secured.context.user.id, projectId, snapshotDigest);
      const review = classifySourceAuthorityReview({ ownerUserId: secured.context.user.id, projectId, context: active.editorialContext, records: active.records });
      return NextResponse.json({ success:true, projectId, snapshotDigest, researchRevision:active.originalSnapshot.research_revision, ...review }, { status:200 });
    } catch (error) {
      const reason = error instanceof Error ? error.message : '';
      const stale = reason === 'RESEARCH_AUTHORITY_NOT_ACTIVE' || reason === 'RESEARCH_AUTHORITY_REVISION_STALE';
      return NextResponse.json({ success:false, status:stale ? 'STALE_RESEARCH' : 'AUTHORITY_INVALID' }, { status:422 });
    }
  }
  try {
    const authority = await loadServerAuthoritativeResearchGraph(secured.context.user.id, projectId, snapshotDigest);
    const decision = body.scopeDecision === undefined || body.scopeDecision === null ? undefined : body.scopeDecision as CounterEvidenceScopeDecision;
    const result = evaluateTrustedEvidence({ authority, decision, ...(body.persistedContext === undefined ? {} : { persistedContext:body.persistedContext }) });
    return NextResponse.json({ success:true, projectId:authority.projectId, snapshotDigest:authority.snapshotDigest, researchRevision:authority.originalSnapshot.research_revision, readiness:result.readiness, verifiedLimitationClaimIds:result.verifiedLimitationClaimIds, review:result.review, blockingReasons:result.generation.reasonCodes, generationEligible:result.generation.eligible, ...(decision ? { proposedScope:result.context } : {}) });
  } catch {
    return NextResponse.json({ success:false, code:'EVIDENCE_AUTHORITY_UNAVAILABLE', error:'Current verified evidence could not be validated.' }, { status:422 });
  }
}
