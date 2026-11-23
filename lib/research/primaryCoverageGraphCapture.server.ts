import 'server-only';
import { createServerSupabaseClient } from '../supabase/server';
import { loadServerAuthoritativeResearchGraph } from './sourceAuthorityWorkflow.server';
import { capturePrimaryCoverageGraph } from './primaryCoverageGraphCapture';
import type { ResearchClaimEvidenceGraph } from './claimEvidenceGraph';
export async function captureServerPrimaryCoverage(input:{ownerUserId:string;projectId:string;parentSnapshotDigest:string;submittedFrozenGraph:ResearchClaimEvidenceGraph;resultGraph:ResearchClaimEvidenceGraph;resultContext:unknown}) {
 if(process.env.VELTO_SOURCE_AUTHORITY_ENABLED!=='true') return {captured:false as const};
 const supabase=createServerSupabaseClient();
 return capturePrimaryCoverageGraph({...input,enabled:true,repository:{loadParent:loadServerAuthoritativeResearchGraph,insertSnapshot:async row=>{const {error}=await supabase.from('creator_source_authority_snapshots').insert(row);if(error)throw new Error('PRIMARY_CAPTURE_WRITE_FAILED');}}});
}
