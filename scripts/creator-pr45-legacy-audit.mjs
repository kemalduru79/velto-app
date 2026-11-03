/**
 * Strictly offline, owner-scoped legacy compatibility classification.
 * Never connects to a database and never prints source content, owner IDs,
 * project IDs, scripts or URLs.
 *
 * Usage: VELTO_AUDIT_OWNER_ID=<owner-uuid> node --experimental-transform-types scripts/creator-pr45-legacy-audit.mjs < authorized-owner-projects.ndjson
 *
 * Input: authorized owner export of full project rows including user_id and
 * exported_movie_result.creatorProjectState. Owner identity must match every
 * row; mismatch is a hard stop rather than a filter silently hiding scope.
 */
import {readSync} from "node:fs";
import {inspectCreatorProjectStatePersistenceAuthority} from "../lib/creator/projectState.ts";
import {isCreatorScriptHistoricalResearchOnly,normalizeCreatorScript} from "../lib/creator/creatorScript.ts";
const owner=process.env.VELTO_AUDIT_OWNER_ID;
if(typeof owner!=="string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(owner)){
  process.stderr.write("AUDIT_OWNER_SCOPE_REQUIRED\n");process.exit(2);
}
// Bound memory before consuming the full export, including piped input.
const chunks=[];let totalBytes=0;
try {
  while(true){
    const chunk=Buffer.alloc(64*1024);
    const size=readSync(0,chunk,0,chunk.length,null);
    if(size===0)break;
    totalBytes+=size;
    if(totalBytes>20*1024*1024){process.stderr.write("AUDIT_INPUT_LIMIT_EXCEEDED\n");process.exit(2);}
    chunks.push(chunk.subarray(0,size));
  }
}catch{process.stderr.write("AUDIT_INPUT_READ_FAILED\n");process.exit(2);}
const contents=Buffer.concat(chunks).toString("utf8");
const rows=contents.split(/\r?\n/).filter(Boolean);
const counts={reviewed:0,current:0,historical_read_only:0,invalid:0,no_script:0,pending_historical:0,pending_invalid:0};
const reasons={};const seen=new Set();
const reason=code=>{reasons[code]=(reasons[code]||0)+1;};
for(const line of rows){
  let data;try{data=JSON.parse(line);}catch{process.stderr.write("AUDIT_RECORD_INVALID\n");process.exit(2);}
  if(!data || data.user_id!==owner || data.flow_type!=="creator_lab"){
    process.stderr.write("AUDIT_OWNER_OR_FLOW_MISMATCH\n");process.exit(2);
  }
  if(typeof data.id!=="string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.id) || seen.has(data.id.toLowerCase())){
    process.stderr.write("AUDIT_PROJECT_ID_INVALID_OR_DUPLICATE\n");process.exit(2);
  }
  seen.add(data.id.toLowerCase());
  const snapshot=data?.exported_movie_result?.creatorProjectState;
  const script=snapshot?.strategy?.script;
  const proposed=snapshot?.strategy?.pendingRefinement?.proposedScript;
  counts.reviewed++;
  if(proposed){
    if(isCreatorScriptHistoricalResearchOnly(proposed)){counts.pending_historical++;reason("PENDING_HISTORICAL_REVALIDATION_REQUIRED");}
    else try{normalizeCreatorScript(proposed);}catch{counts.pending_invalid++;reason("PENDING_SCRIPT_INVALID");}
  }
  let authority;
  try{authority=inspectCreatorProjectStatePersistenceAuthority(data);}
  catch{counts.invalid++;reason("PROJECT_STATE_QUARANTINED");continue;}
  if(authority.status.startsWith("malformed_")){counts.invalid++;reason("PROJECT_STATE_QUARANTINED");continue;}
  if(!script){counts.no_script++;reason(authority.status==="legacy_absent"?"CANONICAL_STATE_ABSENT":"SCRIPT_ABSENT");continue;}
  if(isCreatorScriptHistoricalResearchOnly(script)){counts.historical_read_only++;reason("HISTORICAL_RESEARCH_REVALIDATION_REQUIRED");}
  else try{normalizeCreatorScript(script);counts.current++;reason("CURRENT_SCHEMA_VALID_NOT_GENERATION_APPROVAL");}catch{counts.invalid++;reason("STORED_SCRIPT_INVALID");}
}
process.stdout.write(JSON.stringify({version:"pr45-owner-scoped-readonly-v3",counts,reasons})+"\n");
