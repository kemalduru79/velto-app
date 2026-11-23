import 'server-only';
import { createServerSupabaseClient } from '../supabase/server';
import { getPersistenceServices } from '../persistence';
import { acquireOriginalSourceDocument } from './originalSourceAcquisition.server';
import { createSourceAuthorityWorkflow } from './sourceAuthorityWorkflow';

/** Server-only bindings. The flag and reviewer IDs are operator-managed, never request fields. */
export function createServerSourceAuthorityWorkflow() {
  const supabase = createServerSupabaseClient();
  const reviewers = new Set((process.env.VELTO_SOURCE_AUTHORITY_REVIEWER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean));
  return createSourceAuthorityWorkflow({
    enabled: process.env.VELTO_SOURCE_AUTHORITY_ENABLED === 'true',
    authenticateReviewer: async (token) => {
      if (!token) return null;
      const { data, error } = await supabase.auth.getUser(token);
      return !error && data.user && reviewers.has(data.user.id) ? data.user.id : null;
    },
    ownsProject: async (ownerId, projectId) => {
      const project = await getPersistenceServices().projectRepository.getForOwner(projectId, ownerId);
      return project?.flow_type === 'creator_lab';
    },
    insertSnapshot: async (row) => { const { error } = await supabase.from('creator_source_authority_snapshots').insert(row); if (error) throw new Error('SOURCE_AUTHORITY_SNAPSHOT_WRITE_FAILED'); },
    loadSnapshot: async (ownerId, projectId, digest) => {
      const { data, error } = await supabase.from('creator_source_authority_snapshots').select('owner_user_id,project_id,snapshot_digest,editorial_context').eq('owner_user_id', ownerId).eq('project_id', projectId).eq('snapshot_digest', digest).maybeSingle();
      if (error) throw new Error('SOURCE_AUTHORITY_SNAPSHOT_READ_FAILED');
      return data;
    },
    acquire: async (source) => (await acquireOriginalSourceDocument({ source, authority: 'unknown' })).document,
    insertRecord: async (record) => { const { error } = await supabase.from('creator_source_authority_verifications').insert(record); if (error) throw new Error('SOURCE_AUTHORITY_RECORD_WRITE_FAILED'); },
    now: () => new Date().toISOString(),
  });
}

/** Call only after the caller's Supabase Auth identity has been verified. */
export async function loadServerAuthoritativeResearchGraph(ownerUserId: string, projectId: string, snapshotDigest: string) {
  if (process.env.VELTO_SOURCE_AUTHORITY_ENABLED !== 'true') throw new Error('SOURCE_AUTHORITY_DISABLED');
  const supabase = createServerSupabaseClient();
  const { loadAuthoritativeResearchGraph } = await import('./authoritativeResearchGraph');
  return loadAuthoritativeResearchGraph({ ownerUserId, projectId, snapshotDigest, repository: {
    ownsProject: async (owner, projectId) => (await getPersistenceServices().projectRepository.getForOwner(projectId, owner))?.flow_type === 'creator_lab',
    activeResearch: async (owner, projectId) => {
      const p = await getPersistenceServices().projectRepository.getForOwner(projectId, owner);
      if (!p || p.flow_type !== 'creator_lab') return null;
      return { revision: Number(p.research_revision), digest: typeof p.active_research_snapshot_digest === 'string' ? p.active_research_snapshot_digest : null };
    },
    loadSnapshot: async (owner, projectId, digest) => {
      const { data, error } = await supabase.from('creator_source_authority_snapshots').select('owner_user_id,project_id,snapshot_digest,editorial_context,original_research_graph,initial_research_graph,research_graph_digest,parent_snapshot_digest,research_revision').eq('owner_user_id', owner).eq('project_id', projectId).eq('snapshot_digest', digest).maybeSingle();
      if (error) throw new Error('RESEARCH_AUTHORITY_SNAPSHOT_READ_FAILED');
      return data;
    },
    loadRecords: async (owner, projectId, digest) => {
      const { data, error } = await supabase.from('creator_source_authority_verifications').select('owner_user_id,project_id,snapshot_digest,source_id,claim_id,evidence_id,source_digest,passage_digest,passage_verification,authority_classification,expires_at,claim_evidence_disposition,disposition_rationale,reviewer_user_id,reviewer_authorization,qualification_method,document_digest').eq('owner_user_id', owner).eq('project_id', projectId).eq('snapshot_digest', digest);
      if (error) throw new Error('RESEARCH_AUTHORITY_RECORDS_READ_FAILED');
      return data ?? [];
    },
  } });
}
