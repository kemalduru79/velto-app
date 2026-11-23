import 'server-only';
import { createServerSupabaseClient } from '../supabase/server';
import { loadServerAuthoritativeResearchGraph } from './sourceAuthorityWorkflow.server';
import { capturePrimaryCoverageGraph } from './primaryCoverageGraphCapture';
import type { ResearchClaimEvidenceGraph } from './claimEvidenceGraph';
export async function captureServerPrimaryCoverage(input:{ownerUserId:string;projectId:string;parentSnapshotDigest:string;submittedFrozenGraph:ResearchClaimEvidenceGraph;resultGraph:ResearchClaimEvidenceGraph;resultContext:unknown}) {
 if(process.env.VELTO_SOURCE_AUTHORITY_ENABLED!=='true') return {captured:false as const};
 const supabase=createServerSupabaseClient();
 let revision: number | null = null;
 return capturePrimaryCoverageGraph({...input,enabled:true,repository:{loadParent:async(owner,project,digest)=>{const parent=await loadServerAuthoritativeResearchGraph(owner,project,digest);revision=parent.originalSnapshot.research_revision ?? null;if(!Number.isSafeInteger(revision))throw new Error('PRIMARY_CAPTURE_REVISION_INVALID');return parent;},insertSnapshot:async row=>{if(revision===null)throw new Error('PRIMARY_CAPTURE_REVISION_INVALID');const {error}=await supabase.rpc('creator_activate_research_snapshot',{p_owner:input.ownerUserId,p_project:input.projectId,p_revision:revision,p_parent:input.parentSnapshotDigest,p_snapshot:row});if(error)throw new Error('PRIMARY_CAPTURE_WRITE_FAILED');}}});
}
