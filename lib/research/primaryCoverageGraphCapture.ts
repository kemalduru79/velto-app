import { sourceAuthorityGraphDigest, sourceAuthoritySnapshotDigest } from './sourceAuthorityBoundary.ts';
import { normalizeScriptPlannerEditorialContext } from './scriptPlannerEditorialContext.ts';
import { validateResearchGraphsForSnapshot } from './trustedDispositionResolver.ts';
import type { ResearchClaimEvidenceGraph } from './claimEvidenceGraph.ts';
import type { loadAuthoritativeResearchGraph } from './authoritativeResearchGraph.ts';

type Parent = Awaited<ReturnType<typeof loadAuthoritativeResearchGraph>>;
export async function capturePrimaryCoverageGraph(input: {
 enabled:boolean; ownerUserId:string; projectId:string; parentSnapshotDigest:string;
 submittedFrozenGraph:ResearchClaimEvidenceGraph; resultGraph:ResearchClaimEvidenceGraph; resultContext:unknown;
 repository:{ loadParent:(owner:string,project:string,digest:string)=>Promise<Parent>; insertSnapshot:(row:Record<string,unknown>)=>Promise<void> };
}) {
 if (!input.enabled || !input.ownerUserId || !input.projectId) return {captured:false as const};
 if (!/^[0-9a-f]{64}$/.test(input.parentSnapshotDigest)) throw new Error('PRIMARY_CAPTURE_PARENT_REQUIRED');
 const parent=await input.repository.loadParent(input.ownerUserId,input.projectId,input.parentSnapshotDigest);
 if (parent.ownerUserId!==input.ownerUserId || parent.projectId!==input.projectId || parent.snapshotDigest!==input.parentSnapshotDigest) throw new Error('PRIMARY_CAPTURE_PARENT_MISMATCH');
 if (sourceAuthorityGraphDigest(input.submittedFrozenGraph,input.submittedFrozenGraph)!==sourceAuthorityGraphDigest(parent.originalResearchSnapshot,parent.originalResearchSnapshot)) throw new Error('PRIMARY_CAPTURE_FROZEN_GRAPH_MISMATCH');
 const context=normalizeScriptPlannerEditorialContext(input.resultContext,false);
 if (!context) throw new Error('PRIMARY_CAPTURE_CONTEXT_INVALID');
 const snapshot_digest=sourceAuthoritySnapshotDigest(context);
 const row={owner_user_id:input.ownerUserId,project_id:input.projectId,snapshot_digest,editorial_context:context};
 const {graph,initial}=validateResearchGraphsForSnapshot({ownerUserId:input.ownerUserId,projectId:input.projectId,originalSnapshot:row,originalResearchSnapshot:input.resultGraph,initialResearchSnapshot:parent.initialResearchSnapshot});
 if(snapshot_digest===input.parentSnapshotDigest) {
   if(sourceAuthorityGraphDigest(graph,initial)!==sourceAuthorityGraphDigest(parent.originalResearchSnapshot,parent.initialResearchSnapshot)) throw new Error('PRIMARY_CAPTURE_SNAPSHOT_COLLISION');
   return {captured:true as const,snapshotDigest:snapshot_digest,unchanged:true as const};
 }
 await input.repository.insertSnapshot({...row,original_research_graph:graph,initial_research_graph:initial,research_graph_digest:sourceAuthorityGraphDigest(graph,initial),parent_snapshot_digest:input.parentSnapshotDigest});
 return {captured:true as const,snapshotDigest:snapshot_digest,unchanged:false as const};
}
