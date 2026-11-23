import { NextResponse } from 'next/server';
import { enforceCreatorApiBoundary } from '@/lib/security/creatorApiBoundary';
import { loadServerAuthoritativeResearchGraph } from '@/lib/research/sourceAuthorityWorkflow.server';
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
  try {
    const authority = await loadServerAuthoritativeResearchGraph(secured.context.user.id, projectId, snapshotDigest);
    const decision = body.scopeDecision === undefined || body.scopeDecision === null ? undefined : body.scopeDecision as CounterEvidenceScopeDecision;
    const result = evaluateTrustedEvidence({ authority, decision, ...(body.persistedContext === undefined ? {} : { persistedContext:body.persistedContext }) });
    return NextResponse.json({ success:true, snapshotDigest:authority.snapshotDigest, researchRevision:authority.originalSnapshot.research_revision, readiness:result.readiness, verifiedLimitationClaimIds:result.verifiedLimitationClaimIds, review:result.review, blockingReasons:result.generation.reasonCodes, generationEligible:result.generation.eligible });
  } catch {
    return NextResponse.json({ success:false, code:'EVIDENCE_AUTHORITY_UNAVAILABLE', error:'Current verified evidence could not be validated.' }, { status:422 });
  }
}
