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
