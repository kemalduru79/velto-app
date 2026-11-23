import { createResearchClaimEvidenceGraph } from './claimEvidenceGraph.ts';
import { createResearchTopicReadiness } from './topicEvidenceReadiness.ts';
import { createCounterEvidenceReview, createScriptPlannerGenerationGroundingGate, type CounterEvidenceScopeDecision } from './scriptPlannerEditorialContext.ts';
import { createTrustedScopeReviewedContext, rehydrateTrustedScopeReviewedContext, resolveTrustedDisposition } from './trustedDispositionResolver.ts';
import type { loadAuthoritativeResearchGraph } from './authoritativeResearchGraph.ts';

/** Server callers must obtain `authority` from the authenticated repository. */
export function evaluateTrustedEvidence(input: { authority: Awaited<ReturnType<typeof loadAuthoritativeResearchGraph>>; decision?: CounterEvidenceScopeDecision; persistedContext?: unknown; now?: number }) {
 const a=input.authority;
 if (a.records.some(r => r.claim_evidence_disposition === 'documented_methodological_limitation' && (r.reviewer_authorization !== 'server_verified_reviewer_allowlist' || r.qualification_method !== 'authorized_human_claim_review' || !r.reviewer_user_id || !r.document_digest || !/^[0-9a-f]{64}$/.test(r.document_digest) || !r.disposition_rationale || r.disposition_rationale.trim().length < 12))) throw new Error('TRUSTED_EVIDENCE_DISPOSITION_INVALID');
 const common={ownerUserId:a.ownerUserId,projectId:a.projectId,originalSnapshot:a.originalSnapshot,records:a.records,originalResearchSnapshot:a.originalResearchSnapshot,initialResearchSnapshot:a.initialResearchSnapshot,now:input.now};
 const context=input.decision ? input.persistedContext ? rehydrateTrustedScopeReviewedContext({...common,decision:input.decision,persistedContext:input.persistedContext}) : createTrustedScopeReviewedContext({...common,decision:input.decision}) : a.editorialContext;
 if (!input.decision && input.persistedContext) throw new Error('TRUSTED_EVIDENCE_SCOPE_REQUIRED');
 const verified=resolveTrustedDisposition({...common,scopeDecision:input.decision,projectedContext:context});
 const verifiedIds=new Set(verified);
 const ids=new Set(context.claims.map(c=>c.claimId));
 const graph=createResearchClaimEvidenceGraph({...a.originalResearchSnapshot,claims:a.originalResearchSnapshot.claims.filter(c=>ids.has(c.claimId)),links:a.originalResearchSnapshot.links.filter(l=>ids.has(l.claimId))});
 const assessments=context.sources.map(s=>({sourceId:s.sourceId,directness:s.directness,reviewStatus:s.reviewStatus,provenanceStatus:'unknown' as const,reviewReasons:[]}));
 const readiness=createResearchTopicReadiness({graph,sourceAssessments:assessments,verifiedLimitationClaimIds:verifiedIds});
 return {context,verifiedLimitationClaimIds:[...verified],readiness,review:createCounterEvidenceReview(context,verifiedIds),generation:createScriptPlannerGenerationGroundingGate(context,verifiedIds)};
}
