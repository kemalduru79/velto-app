import { sourceAuthorityGraphDigest, sourceAuthoritySnapshotDigest, validateSourceAuthorityRecords, type SourceAuthorityRecord } from './sourceAuthorityBoundary.ts';
import { validateResearchGraphsForSnapshot } from './trustedDispositionResolver.ts';
import type { ResearchClaimEvidenceGraph } from './claimEvidenceGraph.ts';

export type StoredResearchSnapshot = { owner_user_id: string; project_id: string; snapshot_digest: string; editorial_context: unknown; original_research_graph?: ResearchClaimEvidenceGraph | null; initial_research_graph?: ResearchClaimEvidenceGraph | null; research_graph_digest?: string | null; parent_snapshot_digest?: string | null };

/** The repository is a trusted server adapter; no client graph is accepted. */
export async function loadAuthoritativeResearchGraph(input: {
  ownerUserId: string; projectId: string; snapshotDigest: string; now?: number;
  repository: { ownsProject: (owner: string, project: string) => Promise<boolean>; loadSnapshot: (owner: string, project: string, digest: string) => Promise<StoredResearchSnapshot | null>; loadRecords: (owner: string, project: string, digest: string) => Promise<SourceAuthorityRecord[]> };
}) {
  if (!input.ownerUserId || !input.projectId || !/^[0-9a-f]{64}$/.test(input.snapshotDigest) || !await input.repository.ownsProject(input.ownerUserId, input.projectId)) throw new Error('RESEARCH_AUTHORITY_PROJECT_INVALID');
  const row = await input.repository.loadSnapshot(input.ownerUserId, input.projectId, input.snapshotDigest);
  if (!row || row.owner_user_id !== input.ownerUserId || row.project_id !== input.projectId || row.snapshot_digest !== input.snapshotDigest) throw new Error('RESEARCH_AUTHORITY_SNAPSHOT_INVALID');
  if (!row.original_research_graph || !row.initial_research_graph || !row.research_graph_digest) throw new Error('RESEARCH_AUTHORITY_GRAPHS_UNAVAILABLE');
  if (sourceAuthorityGraphDigest(row.original_research_graph, row.initial_research_graph) !== row.research_graph_digest) throw new Error('RESEARCH_AUTHORITY_GRAPH_DIGEST_MISMATCH');
  if (row.parent_snapshot_digest) {
    if (!/^[0-9a-f]{64}$/.test(row.parent_snapshot_digest) || row.parent_snapshot_digest === row.snapshot_digest) throw new Error('RESEARCH_AUTHORITY_PARENT_INVALID');
    const parent = await input.repository.loadSnapshot(input.ownerUserId, input.projectId, row.parent_snapshot_digest);
    if (!parent || parent.owner_user_id !== input.ownerUserId || parent.project_id !== input.projectId || parent.snapshot_digest !== row.parent_snapshot_digest || !parent.original_research_graph || !parent.initial_research_graph || !parent.research_graph_digest || sourceAuthorityGraphDigest(parent.original_research_graph, parent.initial_research_graph) !== parent.research_graph_digest || sourceAuthorityGraphDigest(parent.initial_research_graph, parent.initial_research_graph) !== sourceAuthorityGraphDigest(row.initial_research_graph, row.initial_research_graph)) throw new Error('RESEARCH_AUTHORITY_PARENT_INVALID');
    validateResearchGraphsForSnapshot({ ownerUserId: input.ownerUserId, projectId: input.projectId, originalSnapshot: parent, originalResearchSnapshot: parent.original_research_graph, initialResearchSnapshot: parent.initial_research_graph });
  }
  const { original, graph, initial } = validateResearchGraphsForSnapshot({ ownerUserId: input.ownerUserId, projectId: input.projectId, originalSnapshot: row, originalResearchSnapshot: row.original_research_graph, initialResearchSnapshot: row.initial_research_graph });
  if (sourceAuthoritySnapshotDigest(original) !== input.snapshotDigest) throw new Error('RESEARCH_AUTHORITY_SNAPSHOT_INVALID');
  const records = await input.repository.loadRecords(input.ownerUserId, input.projectId, input.snapshotDigest);
  if (!validateSourceAuthorityRecords({ ownerUserId: input.ownerUserId, projectId: input.projectId, context: original, records, now: input.now }).ok) throw new Error('RESEARCH_AUTHORITY_RECORDS_INVALID');
  return { ownerUserId: input.ownerUserId, projectId: input.projectId, originalResearchSnapshot: structuredClone(graph), initialResearchSnapshot: structuredClone(initial), originalSnapshot: structuredClone(row), editorialContext: structuredClone(original), snapshotDigest: input.snapshotDigest, records: structuredClone(records) };
}
