import 'server-only';
import { getPersistenceServices } from '../persistence';
import { createServerSupabaseClient } from '../supabase/server';
import { captureEditorialAnalysisGraph } from './editorialGraphCapture';
import type { ResearchClaimEvidenceGraph } from './claimEvidenceGraph';

export async function reserveServerResearchRevision(ownerUserId:string, projectId:string) {
  const supabase=createServerSupabaseClient();
  const {data,error}=await supabase.rpc('creator_begin_research_revision',{p_owner:ownerUserId,p_project:projectId});
  if(error || !Number.isSafeInteger(data) || data < 1) throw new Error('RESEARCH_REVISION_RESERVATION_FAILED');
  return data as number;
}

export async function captureServerEditorialAnalysis(input: { ownerUserId:string; projectId:string; researchRevision:number; context:unknown; originalGraph:ResearchClaimEvidenceGraph; initialGraph:ResearchClaimEvidenceGraph }) {
  if (process.env.VELTO_SOURCE_AUTHORITY_ENABLED !== 'true') return { captured:false as const };
  const supabase = createServerSupabaseClient();
  return captureEditorialAnalysisGraph({...input, enabled:true, repository:{
    ownsProject:async(owner,project)=> (await getPersistenceServices().projectRepository.getForOwner(project,owner))?.flow_type === 'creator_lab',
    insertSnapshot:async(row)=>{
      const {error}=await supabase.rpc('creator_activate_research_snapshot',{p_owner:input.ownerUserId,p_project:input.projectId,p_revision:input.researchRevision,p_parent:null,p_snapshot:row});
      if (error) throw new Error('EDITORIAL_CAPTURE_SNAPSHOT_WRITE_FAILED');
    },
  }});
}
