import 'server-only';
import { getPersistenceServices } from '../persistence';
import { createServerSupabaseClient } from '../supabase/server';
import { captureEditorialAnalysisGraph } from './editorialGraphCapture';
import type { ResearchClaimEvidenceGraph } from './claimEvidenceGraph';

export async function captureServerEditorialAnalysis(input: { ownerUserId:string; projectId:string; context:unknown; originalGraph:ResearchClaimEvidenceGraph; initialGraph:ResearchClaimEvidenceGraph }) {
  if (process.env.VELTO_SOURCE_AUTHORITY_ENABLED !== 'true') return { captured:false as const };
  const supabase = createServerSupabaseClient();
  return captureEditorialAnalysisGraph({...input, enabled:true, repository:{
    ownsProject:async(owner,project)=> (await getPersistenceServices().projectRepository.getForOwner(project,owner))?.flow_type === 'creator_lab',
    insertSnapshot:async(row)=>{
      const {error}=await supabase.from('creator_source_authority_snapshots').insert(row);
      if (error) throw new Error('EDITORIAL_CAPTURE_SNAPSHOT_WRITE_FAILED');
    },
  }});
}
