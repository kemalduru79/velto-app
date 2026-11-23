import { normalizeScriptPlannerEditorialContext } from './scriptPlannerEditorialContext.ts';
import { sourceAuthorityGraphDigest, sourceAuthoritySnapshotDigest } from './sourceAuthorityBoundary.ts';
import { validateResearchGraphsForSnapshot } from './trustedDispositionResolver.ts';
import type { ResearchClaimEvidenceGraph } from './claimEvidenceGraph.ts';

/** Called with server-produced analysis objects, never with a later review payload. */
export async function captureEditorialAnalysisGraph(input: {
  enabled: boolean; ownerUserId: string; projectId: string; context: unknown;
  originalGraph: ResearchClaimEvidenceGraph; initialGraph: ResearchClaimEvidenceGraph;
  repository: {
    ownsProject: (owner: string, project: string) => Promise<boolean>;
    insertSnapshot: (row: {owner_user_id:string; project_id:string; snapshot_digest:string; editorial_context:unknown; original_research_graph:ResearchClaimEvidenceGraph; initial_research_graph:ResearchClaimEvidenceGraph; research_graph_digest:string}) => Promise<void>;
  };
}) {
  if (!input.enabled || !input.ownerUserId || !input.projectId) return { captured: false as const };
  if (!await input.repository.ownsProject(input.ownerUserId, input.projectId)) return { captured: false as const };
  const context = normalizeScriptPlannerEditorialContext(input.context, false);
  if (!context) throw new Error('EDITORIAL_CAPTURE_CONTEXT_INVALID');
  const snapshot_digest = sourceAuthoritySnapshotDigest(context);
  const row = { owner_user_id:input.ownerUserId, project_id:input.projectId, snapshot_digest, editorial_context:context };
  const {graph,initial} = validateResearchGraphsForSnapshot({ownerUserId:input.ownerUserId,projectId:input.projectId,originalSnapshot:row,originalResearchSnapshot:input.originalGraph,initialResearchSnapshot:input.initialGraph});
  await input.repository.insertSnapshot({...row,original_research_graph:graph,initial_research_graph:initial,research_graph_digest:sourceAuthorityGraphDigest(graph,initial)});
  return { captured: true as const, snapshotDigest:snapshot_digest };
}
